const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

/**
 * Identity Reconciliation Service
 * ---------------------------------------------------------------------------
 * Core rules (Bitespeed-style):
 *
 *  1. A "Contact" is either `primary` (the canonical identity) or
 *     `secondary` (linked to exactly one primary via `linkedId`).
 *  2. Incoming request has an email and/or phoneNumber.
 *     - No existing contact matches either field -> create a new `primary`.
 *     - Exactly one match -> if the request carries any field value not
 *       already present in that identity cluster, create a new `secondary`
 *       contact carrying the new info, linked to the cluster's primary.
 *     - Matches span two previously-separate primaries -> the two clusters
 *       must merge. The OLDER primary (by createdAt) stays primary; the
 *       younger primary — and everything linked to it — is demoted to
 *       `secondary` and relinked under the older primary.
 *  3. The response always reports the single true primary, the full set of
 *     emails/phoneNumbers (primary's values first), and all secondary IDs.
 * ---------------------------------------------------------------------------
 */

/**
 * Fetch every contact belonging to the identity cluster(s) rooted at the
 * given primary contact IDs (primary + all of its secondaries).
 */
async function getClusterByPrimaryIds(tx, primaryIds) {
  return tx.contact.findMany({
    where: {
      deletedAt: null,
      OR: [{ id: { in: primaryIds } }, { linkedId: { in: primaryIds } }],
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Resolve a contact to its ultimate primary contact record.
 */
function resolvePrimaryOf(contact, byId) {
  if (contact.linkPrecedence === 'primary') return contact;
  return byId.get(contact.linkedId) || contact;
}

/**
 * Merge two primary clusters into one when a single incoming request turns
 * out to bridge two previously-independent identities.
 * The older primary wins; the younger primary and its secondaries are
 * repointed underneath it.
 */
async function mergeClusters(tx, olderPrimary, youngerPrimary) {
  logger.info('Merging identity clusters', {
    olderPrimaryId: olderPrimary.id,
    youngerPrimaryId: youngerPrimary.id,
  });

  // Demote the younger primary itself.
  await tx.contact.update({
    where: { id: youngerPrimary.id },
    data: {
      linkPrecedence: 'secondary',
      linkedId: olderPrimary.id,
    },
  });

  // Re-parent every contact that was pointing at the younger primary.
  await tx.contact.updateMany({
    where: { linkedId: youngerPrimary.id },
    data: { linkedId: olderPrimary.id },
  });
}

/**
 * Shape the final API response from a resolved cluster.
 */
function buildResponse(primary, cluster) {
  const emails = [];
  const phoneNumbers = [];
  const secondaryContactIds = [];

  // Primary's own values go first, per spec.
  if (primary.email) emails.push(primary.email);
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

  for (const c of cluster) {
    if (c.id === primary.id) continue;
    if (c.email && !emails.includes(c.email)) emails.push(c.email);
    if (c.phoneNumber && !phoneNumbers.includes(c.phoneNumber)) {
      phoneNumbers.push(c.phoneNumber);
    }
    secondaryContactIds.push(c.id);
  }

  return {
    contact: {
      primaryContactId: primary.id,
      emails,
      phoneNumbers,
      secondaryContactIds,
    },
  };
}

/**
 * Main entry point used by the controller.
 * @param {{email: string|null, phoneNumber: string|null}} payload
 */
async function identify({ email, phoneNumber }) {
  return prisma.$transaction(async (tx) => {
    // 1. Find every existing, non-deleted contact that matches either field.
    const directMatches = await tx.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          email ? { email } : undefined,
          phoneNumber ? { phoneNumber } : undefined,
        ].filter(Boolean),
      },
    });

    // --- Case A: brand new identity -----------------------------------
    if (directMatches.length === 0) {
      const created = await tx.contact.create({
        data: { email, phoneNumber, linkPrecedence: 'primary' },
      });
      logger.info('Created new primary contact', { id: created.id });
      return buildResponse(created, [created]);
    }

    // --- Resolve every distinct primary touched by the direct matches --
    // First pass: collect primary IDs referenced (directly or via linkedId).
    const primaryIdSet = new Set();
    for (const m of directMatches) {
      primaryIdSet.add(m.linkPrecedence === 'primary' ? m.id : m.linkedId);
    }

    let cluster = await getClusterByPrimaryIds(tx, [...primaryIdSet]);
    const byId = new Map(cluster.map((c) => [c.id, c]));

    let distinctPrimaries = [...primaryIdSet]
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => a.createdAt - b.createdAt);

    // --- Case B: request bridges two previously-separate identities ----
    if (distinctPrimaries.length > 1) {
      const [oldest, ...youngerOnes] = distinctPrimaries;
      for (const younger of youngerOnes) {
        await mergeClusters(tx, oldest, younger);
      }
      // Re-fetch the now-unified cluster.
      cluster = await getClusterByPrimaryIds(tx, [oldest.id]);
      distinctPrimaries = [oldest];
    }

    const primary = distinctPrimaries[0];

    // --- Case C: does the request carry genuinely new information? -----
    const knownEmails = new Set(cluster.map((c) => c.email).filter(Boolean));
    const knownPhones = new Set(
      cluster.map((c) => c.phoneNumber).filter(Boolean)
    );

    const hasNewEmail = email && !knownEmails.has(email);
    const hasNewPhone = phoneNumber && !knownPhones.has(phoneNumber);

    if (hasNewEmail || hasNewPhone) {
      const secondary = await tx.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: 'secondary',
          linkedId: primary.id,
        },
      });
      cluster = [...cluster, secondary];
      logger.info('Created new secondary contact', {
        id: secondary.id,
        primaryId: primary.id,
      });
    }

    return buildResponse(primary, cluster);
  });
}

module.exports = { identify, buildResponse };

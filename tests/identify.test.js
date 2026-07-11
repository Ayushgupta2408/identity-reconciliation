/**
 * Integration tests for POST /identify.
 *
 * These hit a real (test) database via Prisma — set TEST_DATABASE_URL (or
 * reuse DATABASE_URL pointed at a disposable DB) before running `npm test`.
 * Each test file run starts from a clean `Contact` table.
 */
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/utils/prisma');

beforeEach(async () => {
  await prisma.contact.deleteMany();
});

afterAll(async () => {
  await prisma.contact.deleteMany();
  await prisma.$disconnect();
});

describe('POST /identify', () => {
  test('creates a new primary contact when nothing matches', async () => {
    const res = await request(app)
      .post('/identify')
      .send({ email: 'lorraine@zamazon.com', phoneNumber: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.contact.emails).toEqual(['lorraine@zamazon.com']);
    expect(res.body.contact.phoneNumbers).toEqual(['123456']);
    expect(res.body.contact.secondaryContactIds).toEqual([]);
    expect(typeof res.body.contact.primaryContactId).toBe('number');
  });

  test('creates a secondary contact when new info arrives for a known identity', async () => {
    const first = await request(app)
      .post('/identify')
      .send({ email: 'doc@zamazon.com', phoneNumber: '111111' });

    const primaryId = first.body.contact.primaryContactId;

    const second = await request(app)
      .post('/identify')
      .send({ email: 'emmett@zamazon.com', phoneNumber: '111111' });

    expect(second.status).toBe(200);
    expect(second.body.contact.primaryContactId).toBe(primaryId);
    expect(second.body.contact.emails).toEqual(
      expect.arrayContaining(['doc@zamazon.com', 'emmett@zamazon.com'])
    );
    expect(second.body.contact.secondaryContactIds).toHaveLength(1);
  });

  test('does not create a duplicate contact for an exact repeat request', async () => {
    await request(app)
      .post('/identify')
      .send({ email: 'marty@zamazon.com', phoneNumber: '222222' });

    const repeat = await request(app)
      .post('/identify')
      .send({ email: 'marty@zamazon.com', phoneNumber: '222222' });

    expect(repeat.body.contact.secondaryContactIds).toEqual([]);
  });

  test('merges two previously-separate primary identities', async () => {
    const first = await request(app)
      .post('/identify')
      .send({ email: 'george@zamazon.com', phoneNumber: '333333' });

    // small delay so createdAt ordering is unambiguous
    await new Promise((r) => setTimeout(r, 20));

    const second = await request(app)
      .post('/identify')
      .send({ email: 'biff@zamazon.com', phoneNumber: '444444' });

    const oldestPrimaryId = first.body.contact.primaryContactId;
    const youngerPrimaryId = second.body.contact.primaryContactId;

    // A request linking both identities via shared fields.
    const bridge = await request(app)
      .post('/identify')
      .send({ email: 'george@zamazon.com', phoneNumber: '444444' });

    expect(bridge.body.contact.primaryContactId).toBe(oldestPrimaryId);
    expect(bridge.body.contact.secondaryContactIds).toEqual(
      expect.arrayContaining([youngerPrimaryId])
    );
    expect(bridge.body.contact.emails).toEqual(
      expect.arrayContaining(['george@zamazon.com', 'biff@zamazon.com'])
    );
    expect(bridge.body.contact.phoneNumbers).toEqual(
      expect.arrayContaining(['333333', '444444'])
    );
  });

  test('rejects a payload with neither email nor phoneNumber', async () => {
    const res = await request(app).post('/identify').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('accepts phoneNumber sent as a number and normalizes it to a string', async () => {
    const res = await request(app)
      .post('/identify')
      .send({ email: 'jennifer@zamazon.com', phoneNumber: 555555 });

    expect(res.status).toBe(200);
    expect(res.body.contact.phoneNumbers).toEqual(['555555']);
  });

  test('handles email-only and phoneNumber-only requests', async () => {
    const emailOnly = await request(app)
      .post('/identify')
      .send({ email: 'einstein.dog@zamazon.com' });
    expect(emailOnly.status).toBe(200);

    const phoneOnly = await request(app)
      .post('/identify')
      .send({ phoneNumber: '999999' });
    expect(phoneOnly.status).toBe(200);
  });
});

describe('GET /health', () => {
  test('reports ok when DB is reachable', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

/**
 * Seed / maintenance script.
 *
 *   npm run seed          → create indexes, default settings, the first admin,
 *                           broker profiles and the website's existing listings
 *   npm run db:indexes    → only (re)build indexes (production has autoIndex off)
 *
 * Idempotent: re-running updates the same records instead of duplicating them.
 * It never creates fake leads, clients, deals or statistics.
 *
 * Reads MONGODB_URI, MONGODB_DB and SEED_ADMIN_* from .env.local.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { properties as websiteListings } from '../src/data/properties';
import { Client, Deal, Lead, PropertyModel, Setting, Task, User, Viewing } from '../src/lib/server/models';
import { DEFAULT_SETTINGS } from '../src/lib/server/services/defaults';

const indexesOnly = process.argv.includes('--indexes-only');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set (add it to .env.local).');
  const uriHasDb = /^mongodb(?:\+srv)?:\/\/[^/]+\/[^?/]+/.test(uri);
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || (uriHasDb ? undefined : 'elite_crm') });
  console.log(`Connected to database "${mongoose.connection.name}".`);

  for (const model of [User, Setting, PropertyModel, Lead, Client, Viewing, Deal, Task]) {
    await model.syncIndexes();
  }
  console.log('Indexes are in sync.');
  if (indexesOnly) return;

  // --- Settings -------------------------------------------------------------
  await Setting.updateOne({ key: 'crm' }, { $setOnInsert: { key: 'crm', ...DEFAULT_SETTINGS } }, { upsert: true });
  console.log('Default CRM settings are in place (existing settings were left untouched).');

  // --- First admin ----------------------------------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 8) throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters.');
    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      console.log(`Admin ${adminEmail} already exists — password not changed.`);
    } else {
      await User.create({
        full_name: process.env.SEED_ADMIN_NAME || 'ELITE Administrator',
        email: adminEmail,
        role: 'admin',
        password_hash: await bcrypt.hash(adminPassword, 12),
      });
      console.log(`Created admin ${adminEmail}.`);
    }
  } else {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin creation.');
  }

  // --- Brokers shown on the website ----------------------------------------
  // They get a random password nobody knows; an admin sets a real one from
  // Dashboard → Users (or they use "Forgot password").
  const agentIds = new Map<string, mongoose.Types.ObjectId>();
  for (const listing of websiteListings) {
    const a = listing.agent;
    const email = a.email.toLowerCase();
    if (agentIds.has(email)) continue;
    const agent = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          role: 'broker',
          password_hash: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12),
        },
        $set: {
          full_name: a.full_name_en,
          full_name_ar: a.full_name_ar,
          title_en: a.title_en,
          title_ar: a.title_ar,
          phone: a.phone,
          whatsapp: `+${a.whatsapp.replace(/^\+/, '')}`,
          photo: a.photo,
          languages: a.languages,
          response_minutes: a.response_minutes,
          is_superagent: a.is_superagent,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    agentIds.set(email, agent._id);
  }
  console.log(`Broker profiles: ${agentIds.size}.`);

  // --- Existing website listings -------------------------------------------
  const settings = DEFAULT_SETTINGS;
  for (const listing of websiteListings) {
    const areaKey = settings.locations.find(
      (l) => l.name_en.toLowerCase() === listing.location.area_en.toLowerCase()
    )?.key;
    const listedAt = new Date(Date.now() - listing.listed_days_ago * 86_400_000);

    await PropertyModel.updateOne(
      { reference_number: listing.reference_number },
      {
        $setOnInsert: { listed_at: listedAt, views: 0 },
        $set: {
          title_en: listing.title_en,
          title_ar: listing.title_ar,
          description_en: listing.description_en,
          description_ar: listing.description_ar,
          type: listing.type,
          purpose: listing.purpose,
          price: listing.price,
          currency: listing.currency,
          price_frequency: listing.price_frequency,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          area_sqm: listing.area_sqm,
          plot_sqm: listing.plot_sqm,
          floor: listing.floor,
          total_floors: listing.total_floors,
          parking: listing.parking,
          furnishing: listing.furnishing,
          completion: listing.completion,
          ownership: listing.ownership,
          available_from: new Date(listing.available_from),
          handover: listing.handover,
          developer_en: listing.developer_en,
          developer_ar: listing.developer_ar,
          year_built: listing.year_built,
          service_charge_sqm: listing.service_charge_sqm,
          location: { ...listing.location, area_key: areaKey },
          amenities: listing.amenities,
          highlights: listing.highlights,
          images: listing.images,
          floor_plan: listing.floor_plan,
          is_featured: listing.is_featured,
          is_verified: listing.is_verified,
          is_exclusive: listing.is_exclusive,
          is_active: true,
          assigned_agent: agentIds.get(listing.agent.email.toLowerCase()),
          market: listing.market,
          nearby: listing.nearby,
          payment_plan: listing.payment_plan ?? [],
        },
      },
      { upsert: true, runValidators: true }
    );
  }
  console.log(`Website listings: ${websiteListings.length} upserted.`);
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });

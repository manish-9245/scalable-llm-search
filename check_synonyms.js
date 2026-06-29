import { query } from './src/config/db.js';

async function check() {
  try {
    const slangRes = await query("SELECT term, meaning FROM slang_vectors WHERE term ILIKE '%pukhraj%' OR term ILIKE '%sapphire%' OR term ILIKE '%poony%' OR term ILIKE '%poonchi%'");
    console.log('Slang matches:', slangRes.rows);

    const ontRes = await query("SELECT synonym, target_value FROM search_ontology WHERE synonym ILIKE '%pukhraj%' OR synonym ILIKE '%sapphire%' OR synonym ILIKE '%poony%' OR synonym ILIKE '%poonchi%'");
    console.log('Ontology matches:', ontRes.rows);

    const checkPukhraj = await query("SELECT term, meaning FROM slang_vectors LIMIT 20");
    console.log('Sample slangs from target DB:', checkPukhraj.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const targetDbUrl = process.env.DATABASE_URL;
const oldDbUrl = process.env.OLD_DATABASE_URL;

async function fillGemstones() {
  const targetPool = new pg.Pool({ connectionString: targetDbUrl, ssl: false });
  const oldClient = new pg.Client({ connectionString: oldDbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await targetPool.connect();
    await oldClient.connect();

    console.log('Fetching gemstones from old DB...');
    const gemRes = await oldClient.query('SELECT product_id, gemstone FROM product_gemstones');
    console.log(`Found ${gemRes.rows.length} gemstone records.`);

    // Group by product
    const productGems = {};
    gemRes.rows.forEach(r => {
      const pid = r.product_id;
      const rawGem = r.gemstone.toLowerCase();
      if (!productGems[pid]) productGems[pid] = new Set();
      
      if (rawGem.includes('ruby') || rawGem.includes('kemp') || rawGem.includes('red stone')) productGems[pid].add('ruby');
      else if (rawGem.includes('emerald') || rawGem.includes('green stone')) productGems[pid].add('emerald');
      else if (rawGem.includes('pearl') || rawGem.includes('moti')) productGems[pid].add('pearl');
      else if (rawGem.includes('sapphire') || rawGem.includes('pukhraj') || rawGem.includes('neelam')) productGems[pid].add('sapphire');
      else if (rawGem.includes('diamond') || rawGem.includes('heera') || rawGem.includes('polki') || rawGem.includes('kundan')) productGems[pid].add('diamond');
      else if (rawGem.includes('synthetic')) productGems[pid].add('synthetic');
    });

    let count = 0;
    for (const [pid, gemSet] of Object.entries(productGems)) {
      const gemArray = Array.from(gemSet);
      if (gemArray.length === 0) continue;

      // Update target DB
      // We will append these gemstones to the existing all_gemstones_array avoiding duplicates
      const query = `
        UPDATE catalog_products
        SET all_gemstones_array = ARRAY(
          SELECT DISTINCT unnest(array_append(all_gemstones_array, g))
          FROM unnest($1::text[]) AS g
        )
        WHERE id = $2
      `;
      await targetPool.query(query, [gemArray, pid]);
      count++;
      if (count % 500 === 0) console.log(`Updated ${count} products...`);
    }

    // Also remove 'none' if there are other gemstones in the array
    await targetPool.query(`
      UPDATE catalog_products
      SET all_gemstones_array = array_remove(all_gemstones_array, 'none')
      WHERE array_length(all_gemstones_array, 1) > 1 AND 'none' = ANY(all_gemstones_array)
    `);

    console.log(`Finished updating ${count} products with correct gemstones.`);
  } catch (err) {
    console.error(err);
  } finally {
    await targetPool.end();
    await oldClient.end();
  }
}

fillGemstones();

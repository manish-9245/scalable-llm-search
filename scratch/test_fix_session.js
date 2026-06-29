import { query } from '../src/config/db.js';
import { QueryBuilder, getRawSql } from '../src/utils/QueryBuilder.js';
import { getLatestMetalRates, buildDynamicPriceSQL } from '../src/services/searchService.js';

async function test() {
    const rates = await getLatestMetalRates();
    const dynamicPriceSQL = buildDynamicPriceSQL(rates);
    
    const qb = new QueryBuilder();
    qb.setDynamicPriceSQL(dynamicPriceSQL);
    qb.setEmbedding(new Array(384).fill(0)); // Dummy embedding
    qb.setFtsQuery('rings under 50k');
    qb.addStringFilter('category', '=', 'Finger Rings');
    qb.addNumericFilter('price', '<=', 50000);
    
    const { sql, values } = qb.build();
    const rawSql = getRawSql(sql, values);
    
    console.log('Generated SQL:', rawSql);
    
    try {
        const res = await query(sql, values);
        console.log(`Found ${res.rows.length} products.`);
        if (res.rows.length > 0) {
            console.log('Sample product:', {
                name: res.rows[0].name,
                calculated_price: res.rows[0].calculated_price
            });
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();

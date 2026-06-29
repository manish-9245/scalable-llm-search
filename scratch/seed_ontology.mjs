
import { query } from '../src/config/db.js';

const seedData = [
    { synonym: 'jhumkas', domain: 'category', target_value: 'Earrings' },
    { synonym: 'jhumkas', domain: 'jewellery_type', target_value: 'Jhumkas' },
    { synonym: 'jhumka', domain: 'category', target_value: 'Earrings' },
    { synonym: 'jhumka', domain: 'jewellery_type', target_value: 'Jhumkas' },
    { synonym: 'moti', domain: 'gemstone', target_value: 'pearl' },
    { synonym: 'pearls', domain: 'gemstone', target_value: 'pearl' },
    { synonym: 'thushi', domain: 'category', target_value: 'Necklaces' },
    { synonym: 'kadas', domain: 'category', target_value: 'Bangles' },
    { synonym: 'kada', domain: 'category', target_value: 'Bangles' },
    { synonym: 'rings', domain: 'category', target_value: 'Finger Rings' },
    { synonym: 'studs', domain: 'category', target_value: 'Earrings' },
    { synonym: 'studs', domain: 'jewellery_type', target_value: 'Stud' },
    { synonym: 'chandbalis', domain: 'category', target_value: 'Earrings' },
    { synonym: 'chandbalis', domain: 'jewellery_type', target_value: 'Chandbalis' }
];

async function run() {
    console.log("Seeding search_ontology...");
    for (const item of seedData) {
        await query(`
            INSERT INTO search_ontology (synonym, domain, target_value)
            VALUES ($1, $2, $3)
            ON CONFLICT (synonym, domain) DO UPDATE SET target_value = EXCLUDED.target_value
        `, [item.synonym, item.domain, item.target_value]);
    }
    console.log("Seeding complete.");
    process.exit(0);
}

run().catch(console.error);

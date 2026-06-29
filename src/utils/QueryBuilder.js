
export function getRawSql(sql, values) {
    if (!values || !values.length) return sql;
    let formattedSql = sql;
    for (let i = values.length; i >= 1; i--) {
        const val = values[i - 1];
        let valStr = '';
        if (val === null || val === undefined) {
            valStr = 'NULL';
        } else if (typeof val === 'number') {
            valStr = val.toString();
        } else if (typeof val === 'boolean') {
            valStr = val ? 'TRUE' : 'FALSE';
        } else if (typeof val === 'string') {
            let escaped = val.replace(/'/g, "''");
            if (escaped.length > 500) {
                valStr = `'${escaped.substring(0, 500)}... [TRUNCATED]'`;
            } else {
                valStr = `'${escaped}'`;
            }
        } else {
            let escaped = JSON.stringify(val).replace(/'/g, "''");
            valStr = `'${escaped}'`;
        }
        const regex = new RegExp(`\\$${i}(?!\\d)`, 'g');
        formattedSql = formattedSql.replace(regex, valStr);
    }
    return formattedSql;
}

export class QueryBuilder {
    constructor() {
        this.params = [];
        this.paramIndex = 1;
        this.filters = [];
        this.joins = new Set();
        this.limit = 12;
        this.orderBy = 'rrf_score DESC';
        this.embeddingParamIndex = null;
        this.ftsParamIndex = null;
        this.rrfConstant = 60;
        this.embeddingDim = 384;
        this.dynamicPriceSQL = 'p.base_price';
    }

    setDynamicPriceSQL(sql) {
        this.dynamicPriceSQL = sql;
    }

    addParam(value) {
        this.params.push(value);
        return this.paramIndex++;
    }

    setEmbedding(embedding) {
        const embStr = Array.isArray(embedding) ? `[${embedding.join(',')}]` : embedding;
        this.embeddingParamIndex = this.addParam(embStr);
    }

    setFtsQuery(ftsQuery) {
        if (ftsQuery) {
            this.ftsParamIndex = this.addParam(ftsQuery);
        }
    }

    addFilter(sql) {
        this.filters.push(sql);
    }

    addNumericFilter(key, operator, value) {
        const idx = this.addParam(value);
        const col = key === 'price' ? 'base_price' : key;
        this.addFilter(`p.${col} ${operator} $${idx}`);
    }

    addStringFilter(key, operator, value, isNegation = false) {
        const op = isNegation ? 'NOT ILIKE' : 'ILIKE';

        if (key === 'category') {
            const idx = this.addParam(value.includes('%') ? value : `%${value}%`);
            this.addFilter(`p.category ${op} $${idx}`);
        } else if (key === 'metal_color') {
            let normalizedValue = value;
            if (value && value.toLowerCase() === 'rose') normalizedValue = 'Pink';
            const idx = this.addParam(normalizedValue.includes('%') ? normalizedValue : `%${normalizedValue}%`);
            this.addFilter(`p.metal_color ${op} $${idx}`);
        } else if (key === 'gender') {
            if (isNegation) {
                const idx = this.addParam(value);
                this.addFilter(`p.gender != $${idx}`);
            } else {
                if (value === 'Men') {
                    this.addFilter(`p.gender IN ('Men', 'Unisex')`);
                } else if (value === 'Women') {
                    this.addFilter(`p.gender IN ('Women', 'Unisex')`);
                } else {
                    const idx = this.addParam(value);
                    this.addFilter(`p.gender = $${idx}`);
                }
            }
        } else if (key === 'gemstone') {
            const cleanVal = value.replace(/%/g, '');
            const pIdx = this.addParam(`%${cleanVal}%`);
            const vIdx = this.addParam(cleanVal);
            
            if (isNegation) {
                this.addFilter(`(
                    NOT (all_gemstones_array && ARRAY[$${vIdx}]::text[])
                    AND NOT EXISTS (SELECT 1 FROM product_gemstone_metrics pgm WHERE pgm.product_id = p.id AND pgm.stone_category ILIKE $${pIdx})
                    AND NOT (to_tsvector('english', coalesce(p.name, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.ai_description, '')) @@ websearch_to_tsquery('english', $${vIdx}))
                )`);
            } else {
                this.addFilter(`(
                    all_gemstones_array && ARRAY[$${vIdx}]::text[]
                    OR EXISTS (SELECT 1 FROM product_gemstone_metrics pgm WHERE pgm.product_id = p.id AND pgm.stone_category ILIKE $${pIdx})
                    OR (to_tsvector('english', coalesce(p.name, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.ai_description, '')) @@ websearch_to_tsquery('english', $${vIdx}))
                )`);
            }
        } else if (key === 'motif') {
            const cleanVal = value.replace(/%/g, '');
            const pIdx = this.addParam(`%${cleanVal}%`);
            const vIdx = this.addParam(cleanVal);
            
            if (isNegation) {
                this.addFilter(`(
                    NOT (all_motifs_array && ARRAY[$${vIdx}]::text[])
                    AND NOT EXISTS (SELECT 1 FROM product_motifs pm WHERE pm.product_id = p.id AND pm.motif ILIKE $${pIdx})
                    AND NOT (to_tsvector('english', coalesce(p.name, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.ai_description, '')) @@ websearch_to_tsquery('english', $${vIdx}))
                )`);
            } else {
                this.addFilter(`(
                    all_motifs_array && ARRAY[$${vIdx}]::text[]
                    OR EXISTS (SELECT 1 FROM product_motifs pm WHERE pm.product_id = p.id AND pm.motif ILIKE $${pIdx})
                    OR (to_tsvector('english', coalesce(p.name, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.ai_description, '')) @@ websearch_to_tsquery('english', $${vIdx}))
                )`);
            }
        } else if (key === 'occasion') {
            const idx = this.addParam(value.includes('%') ? value : `%${value}%`);
            if (isNegation) {
                this.addFilter(`(p.occasion ${op} $${idx} AND NOT EXISTS (SELECT 1 FROM product_occasions po WHERE po.product_id = p.id AND po.occasion ${op} $${idx}))`);
            } else {
                this.addFilter(`(p.occasion ${op} $${idx} OR EXISTS (SELECT 1 FROM product_occasions po WHERE po.product_id = p.id AND po.occasion ${op} $${idx}))`);
            }
        } else {
            const idx = this.addParam(value.includes('%') ? value : `%${value}%`);
            this.addFilter(`p.${key} ${op} $${idx}`);
        }
    }

    build() {
        const filterSql = this.filters.length > 0 ? ` AND ${this.filters.join(' AND ')}` : '';
        const joinSql = Array.from(this.joins).map(j => `LEFT JOIN ${j} ON p.id = ${j.split(' ')[1]}.product_id`).join('\n');

        const sql = `
            WITH vector_ranks AS (
                SELECT id, row_number() OVER (ORDER BY (embedding::halfvec(${this.embeddingDim})) <=> $${this.embeddingParamIndex}::halfvec(${this.embeddingDim})) as rank_v
                FROM catalog_products
                WHERE embedding IS NOT NULL
                ORDER BY (embedding::halfvec(${this.embeddingDim})) <=> $${this.embeddingParamIndex}::halfvec(${this.embeddingDim})
                LIMIT 1000
            ),
            fts_ranks AS (
                SELECT id, row_number() OVER (ORDER BY ts_rank_cd(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(ai_description, '')), websearch_to_tsquery('english', $${this.ftsParamIndex})) DESC) as rank_f
                FROM catalog_products
                WHERE to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(ai_description, '')) @@ websearch_to_tsquery('english', $${this.ftsParamIndex})
                ORDER BY ts_rank_cd(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(ai_description, '')), websearch_to_tsquery('english', $${this.ftsParamIndex})) DESC
                LIMIT 1000
            )
            SELECT p.*, ${this.dynamicPriceSQL} as calculated_price,
                   (1.0 / (${this.rrfConstant} + COALESCE(v.rank_v, 1000))) + 
                   (1.0 / (${this.rrfConstant} + COALESCE(f.rank_f, 1000))) AS rrf_score
            FROM catalog_products p
            ${joinSql}
            LEFT JOIN vector_ranks v ON p.id = v.id
            LEFT JOIN fts_ranks f ON p.id = f.id
            WHERE 1=1 ${filterSql}
            AND (v.rank_v IS NOT NULL OR f.rank_f IS NOT NULL OR ${this.filters.length > 0 ? 'TRUE' : 'FALSE'})
            ORDER BY ${this.orderBy}
            LIMIT ${parseInt(this.limit)}
        `;

        return { sql, values: this.params };
    }
}

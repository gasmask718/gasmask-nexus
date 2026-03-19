-- Fix numeric columns that overflow on CSV imports
-- rating: NUMERIC(2,1) -> NUMERIC(5,2) to handle ratings like 4.50
ALTER TABLE brandaro_qualified_leads ALTER COLUMN rating TYPE NUMERIC(5,2);

-- proposal_amount: NUMERIC(10,2) -> NUMERIC(15,2) for larger proposals
ALTER TABLE brandaro_qualified_leads ALTER COLUMN proposal_amount TYPE NUMERIC(15,2);

-- revenue_amount: NUMERIC(10,2) -> NUMERIC(15,2) for larger revenue
ALTER TABLE brandaro_qualified_leads ALTER COLUMN revenue_amount TYPE NUMERIC(15,2);

-- priority_score and engagement_score: INTEGER -> NUMERIC(10,2) to handle decimal scores from AI
ALTER TABLE brandaro_qualified_leads ALTER COLUMN priority_score TYPE NUMERIC(10,2);
ALTER TABLE brandaro_qualified_leads ALTER COLUMN engagement_score TYPE NUMERIC(10,2);
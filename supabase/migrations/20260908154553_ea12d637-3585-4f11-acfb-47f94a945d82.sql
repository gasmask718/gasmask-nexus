-- =====================================================================
-- ICW 51-JURISDICTION LICENSING RESEARCH LOAD
-- Source: Anthropic Advanced Research pass, Aug 26 2026
--
-- *** THIS IS A RESEARCH PASS, NOT A LEGAL SIGN-OFF. ***
-- Review by a licensing attorney is required before operational use.
-- Known soft spots:
--   * ALABAMA  - commercial GC threshold (50000) is LOW confidence; spot-check
--                the AL Licensing Board for General Contractors.
--   * MARYLAND - mold remediation status under MHIC is unconfirmed; spot-check
--                the MD Home Improvement Commission.
--   * ILLINOIS - the Mold Remediation Registration Act (410 ILCS 105 /
--                PA 103-893) is PASSED BUT NOT YET ENFORCEABLE pending IDPH
--                rulemaking. Do NOT treat as a hard gate yet.
--   * TEXAS    - individual worker mold licensing is required as of 9/1/2025
--                (TDLR, Occ. Code Ch 1958; SB 1255). This is NEWER than most
--                states' rules - do not overwrite with an older assumption.
-- =====================================================================

WITH research(state, abbreviation, tier, priority_rank, snow_vertical,
              deli_oven_market_density, handyman_license_status, handyman_threshold_usd,
              handyman_city_county_override_notes, pest_control_license_required,
              pest_control_agency, biohazard_license_required_notes,
              restoration_threshold_usd, mold_remediation_specific_license_notes,
              confidence, handyman_license_gate, specialty_license_gate) AS (
VALUES
('New York','NY','1',1,true,'HIGH','LOCAL_ONLY','SET_LOCALLY','NYC HIC (DCWP) >200; Buffalo; Suffolk/Nassau/Westchester/Putnam/Rockland counties',true,'NY Dept of Environmental Conservation (DEC)','N','LOCAL','Y - assessor, remediation contractor, worker (NYSDOL, Labor Law Art. 32)','HIGH','Y','Y'),
('New Jersey','NJ','1',2,true,'HIGH','N_HIC_REGISTRATION','Register w/ Div of Consumer Affairs',NULL,true,'NJ Dept of Environmental Protection','N','0','N','HIGH','Y','N'),
('California','CA','1',3,false,'MEDIUM','N_UNDER_THRESHOLD','1000 (raised from 500, AB 2622, eff 1/1/2025)','Some cities add HIC permits',true,'CA Dept of Pesticide Regulation + Structural Pest Control Board','Y - Trauma Scene Waste Mgmt Practitioner (CDPH)','1000','N','HIGH','Y','Y'),
('Texas','TX','1',4,false,'MEDIUM','N','No state GC/handyman license','Houston/Dallas/San Antonio/Austin/Fort Worth registration',true,'TX Dept of Agriculture, Structural Pest Control Service','N','0','Y - assessor & remediator + individual workers (TDLR, Occ. Code Ch 1958; SB 1255 eff 9/1/2025)','HIGH','N','Y'),
('Florida','FL','1',5,false,'MEDIUM','N_STATE_COUNTY','County 500-1000; FS 489.103 1000 exemption','Many counties issue Handyman Certificates',true,'FL Dept of Agriculture & Consumer Services (FDACS)','Y - Biomedical Waste registration (FL Dept of Health)','1000','Y - assessor (MRSA) & remediator (MRSR), DBPR, FS 468 Pt XVI','HIGH','Y','Y'),
('Illinois','IL','1',6,true,'MEDIUM','LOCAL_ONLY','SET_LOCALLY','Chicago Home Repair license',true,'IL Dept of Agriculture (outdoor) / Dept of Public Health (structural)','N','LOCAL','REGISTRATION_PENDING - Mold Remediation Registration Act (410 ILCS 105/PA 103-893), IDPH rules not yet adopted/enforceable','HIGH','Y','N'),
('Pennsylvania','PA','1',7,true,'MEDIUM','N_HIC_REGISTRATION','>5000/yr (register w/ AG)','Philadelphia licenses all contractors',true,'PA Dept of Agriculture','N','5000','N','HIGH','Y','N'),
('Georgia','GA','1',8,false,'LOW','DEPENDS','2500','County business licenses',true,'GA Dept of Agriculture / Structural Pest Control Commission','Y - Trauma Scene Waste Mgmt Practitioner registration','2500','N','HIGH','Y','Y'),
('District of Columbia','DC','1',9,true,'MEDIUM','Y_HIC_LICENSE','ALL_RESIDENTIAL_REPAIR','Basic business license also required',true,'DC Dept of Energy & Environment (DOEE)','N','0','Y - assessor & remediator (DOEE)','HIGH','Y','Y'),
('North Carolina','NC','2',10,false,'LOW','Y_GC','40000 (N.C. Gen. Stat. Sec 87-1, HB 488, eff 10/1/2023)',NULL,true,'NC Dept of Agriculture & Consumer Services','N','40000','N','HIGH','Y','N'),
('Ohio','OH','2',11,true,'LOW','LOCAL_COMM_TRADES_STATE','SET_LOCALLY','Cities require registration; state licenses electrical/HVAC/plumbing/hydronics/refrigeration',true,'OH Dept of Agriculture','N','LOCAL','N','MEDIUM','Y','N'),
('Arizona','AZ','2',12,false,'LOW','N_EXEMPT','1000','City privilege-tax license',true,'AZ Dept of Agriculture','N','1000','N','HIGH','Y','N'),
('Massachusetts','MA','2',13,true,'MEDIUM','Y_HIC_REGISTRATION','ANY_1_4_FAMILY_WORK',NULL,true,'MA Dept of Agricultural Resources','N','0','N','HIGH','Y','N'),
('Virginia','VA','2',14,true,'LOW','Y_CLASS_A_B_C','1000 (Class C <=10000)',NULL,true,'VA Dept of Agriculture & Consumer Services','N','1000','IICRC certification required to remediate residential mold (HB 1270, VCPA, eff 7/1/2024)','HIGH','Y','Y'),
('Washington','WA','2',15,true,'LOW','Y_L_AND_I_REGISTRATION','ALL_CONSTRUCTION_WORK',NULL,true,'WA State Dept of Agriculture','N','0','N','HIGH','Y','N'),
('Michigan','MI','2',16,true,'LOW','Y_RESIDENTIAL_BUILDER','REPAIR_ALTERATION_WORK',NULL,true,'MI Dept of Agriculture & Rural Development','N','0','N','MEDIUM','Y','N'),
('Maryland','MD','2',17,true,'MEDIUM','Y_MHIC_LICENSE','ANY_HOME_IMPROVEMENT',NULL,true,'MD Dept of Agriculture','N','0','POSSIBLY_UNDER_MHIC_VERIFY','HIGH','Y','Y'),
('Colorado','CO','2',18,true,'LOW','LOCAL_ONLY','SET_LOCALLY','Denver, Colorado Springs, Boulder license',true,'CO Dept of Agriculture','N','LOCAL','N','HIGH','Y','N'),
('Tennessee','TN','2',19,false,'LOW','Y_GC','>25000 GC; 3000-24999 Home Improvement (9 counties)','Home Improvement license only in Bradley/Davidson/Hamilton/Haywood/Knox/Marion/Robertson/Rutherford/Shelby',true,'TN Dept of Agriculture','N','25000','Remediator - mold classification on contractor license','HIGH','Y','Y'),
('Indiana','IN','3',20,true,'LOW','LOCAL_ONLY','SET_LOCALLY','Most large cities require registration',true,'Office of Indiana State Chemist (Purdue)','N','LOCAL','N','MEDIUM','Y','N'),
('Missouri','MO','3',21,true,'LOW','LOCAL_ONLY','SET_LOCALLY','Kansas City, St. Louis differ',true,'MO Dept of Agriculture','N','LOCAL','N','MEDIUM','Y','N'),
('Wisconsin','WI','3',22,true,'LOW','Y_DWELLING_CONTRACTOR','Permit work / >1000',NULL,true,'WI Dept of Agriculture, Trade & Consumer Protection','N','1000','N','MEDIUM','Y','N'),
('Minnesota','MN','3',23,true,'LOW','Y_RESIDENTIAL_REMODELER','>15000/yr',NULL,true,'MN Dept of Agriculture','N','15000','N','MEDIUM','Y','N'),
('South Carolina','SC','3',24,false,'LOW','DEPENDS','Specialty >500; GC >10000',NULL,true,'Clemson University Dept of Pesticide Regulation','N','10000','N','MEDIUM','Y','N'),
('Alabama','AL','3',25,false,'LOW','N_GC_ONLY','10000 res / 50000 comm (verify comm figure)',NULL,true,'AL Dept of Agriculture & Industries','N','10000','N','LOW','Y','N'),
('Louisiana','LA','3',26,false,'LOW','DEPENDS','<7500 none; 7500-75000 HIR; >75000 res / >50000 comm','New Orleans parish permits',true,'LA Dept of Agriculture & Forestry','N','75000','Y - mold remediation specialist (State Licensing Board for Contractors)','HIGH','Y','Y'),
('Kentucky','KY','3',27,true,'LOW','LOCAL_ONLY','SET_LOCALLY','Louisville & Lexington registration',true,'KY Dept of Agriculture','N','LOCAL','STATUTORY_STANDARD_NO_LICENSE','MEDIUM','Y','N'),
('Oregon','OR','3',28,true,'LOW','Y_CCB_LICENSE','Nearly all work; 1000 minor exemption',NULL,true,'OR Dept of Agriculture','N','1000','Remediator - restoration endorsement on CCB license','HIGH','Y','Y'),
('Connecticut','CT','3',29,true,'LOW','Y_HIC_REGISTRATION','ANY_RESIDENTIAL_WORK',NULL,true,'CT Dept of Energy & Environmental Protection (DEEP)','N','0','STATUTORY_STANDARD_NO_LICENSE','HIGH','Y','N'),
('Utah','UT','4',30,true,'LOW','Y_DOPL','3000 (1000-3000 exemption filing)',NULL,true,'UT Dept of Agriculture & Food','N','3000','N','MEDIUM','Y','N'),
('Nevada','NV','4',31,false,'LOW','Y','1000',NULL,true,'NV Dept of Agriculture','N','1000','N','MEDIUM','Y','N'),
('Arkansas','AR','4',32,false,'LOW','DEPENDS','2000 (Remodeler 2000-50000)','City business licenses',true,'AR Dept of Agriculture, State Plant Board','N','2000','N','MEDIUM','Y','N'),
('Oklahoma','OK','4',33,false,'LOW','N','No state GC license','Cities may require registration',true,'OK Dept of Agriculture, Food & Forestry','N','0','N','MEDIUM','N','N'),
('Iowa','IA','4',34,true,'LOW','REGISTRATION','>=2000/yr','Des Moines adds licenses',true,'IA Dept of Agriculture & Land Stewardship','N','2000','N','MEDIUM','Y','N'),
('Kansas','KS','4',35,true,'LOW','LOCAL_ONLY','SET_LOCALLY (<1000 typical)','Johnson County Class C license',true,'KS Dept of Agriculture','N','LOCAL','N','MEDIUM','Y','N'),
('New Mexico','NM','4',36,true,'LOW','Y','Any construction',NULL,true,'NM Dept of Agriculture','N','0','N','MEDIUM','Y','N'),
('Nebraska','NE','5',37,true,'LOW','N_REGISTER','Register w/ Dept of Labor',NULL,true,'NE Dept of Agriculture','N','0','N','MEDIUM','Y','N'),
('West Virginia','WV','5',38,true,'LOW','Y_CONTRACTOR_LICENSE','2500',NULL,true,'WV Dept of Agriculture','N','2500','N','MEDIUM','Y','N'),
('Idaho','ID','5',39,true,'LOW','REGISTRATION','>2000/yr','Boise adds requirements',true,'Idaho State Dept of Agriculture','N','2000','N','MEDIUM','Y','N'),
('New Hampshire','NH','5',40,true,'LOW','N','No state license',NULL,true,'NH Dept of Agriculture, Div of Pesticide Control','N','0','Assessor only (RSA 310-A)','MEDIUM','N','N'),
('Maine','ME','5',41,true,'LOW','LOCAL_ONLY','No state limit; >3000 written contract required','Portland building-contractor license',true,'ME Dept of Agriculture, Board of Pesticides Control','N','LOCAL','STATUTORY_STANDARD_NO_LICENSE','MEDIUM','Y','N'),
('Rhode Island','RI','5',42,true,'LOW','N_REGISTRATION','Register w/ CRLB (minor repairs <500 exempt)',NULL,true,'RI Dept of Environmental Management','N','500','N','MEDIUM','Y','N'),
('Montana','MT','5',43,true,'LOW','N_REGISTER_IF_EMPLOYEES','Register w/ Dept of Labor','Local rules vary',true,'MT Dept of Agriculture','N','0','N','MEDIUM','Y','N'),
('Delaware','DE','5',44,true,'LOW','REVENUE_BASED','50000/yr receipts','New Castle County stricter',true,'DE Dept of Agriculture','N','50000','N','MEDIUM','Y','N'),
('South Dakota','SD','5',45,true,'LOW','N','No state license',NULL,true,'SD Dept of Agriculture & Natural Resources','N','0','N','MEDIUM','N','N'),
('North Dakota','ND','5',46,true,'LOW','Y','4000',NULL,true,'ND Dept of Agriculture','N','4000','N','MEDIUM','Y','N'),
('Hawaii','HI','5',47,false,'LOW','Y','1000 (or 2+ trades)','County permits enforced',true,'HI Dept of Agriculture','N','1000','N','MEDIUM','Y','N'),
('Alaska','AK','5',48,true,'LOW','Y','10000','Boroughs may add tax registration',true,'AK Dept of Environmental Conservation','N','10000','N','MEDIUM','Y','N'),
('Vermont','VT','5',49,true,'LOW','LOCAL_ONLY','No state GC license','Municipal; trades via Div of Fire Safety',true,'VT Agency of Agriculture, Food & Markets','N','LOCAL','N','MEDIUM','Y','N'),
('Wyoming','WY','5',50,true,'LOW','LOCAL_ONLY','No state license','Larger cities license',true,'WY Dept of Agriculture','N','LOCAL','N','MEDIUM','Y','N'),
('Mississippi','MS','5',51,false,'LOW','Y_GC','Res remodel >10000; build >50000',NULL,true,'MS Dept of Agriculture & Commerce','N','10000','N','MEDIUM','Y','N')
)
INSERT INTO public.icw_state_config AS c (
  state, abbreviation, tier, priority_rank, snow_vertical, deli_oven_market_density,
  handyman_license_status, handyman_threshold_usd, handyman_city_county_override_notes,
  pest_control_license_required, pest_control_agency, biohazard_license_required_notes,
  restoration_threshold_usd, mold_remediation_specific_license_notes,
  confidence, handyman_license_gate, specialty_license_gate,
  verified, last_verified_date, source, notes, updated_at
)
SELECT r.state, r.abbreviation, r.tier, r.priority_rank, r.snow_vertical, r.deli_oven_market_density,
       r.handyman_license_status, r.handyman_threshold_usd, r.handyman_city_county_override_notes,
       r.pest_control_license_required, r.pest_control_agency, r.biohazard_license_required_notes,
       r.restoration_threshold_usd, r.mold_remediation_specific_license_notes,
       r.confidence, r.handyman_license_gate, r.specialty_license_gate,
       true, DATE '2026-08-26',
       'Anthropic Advanced Research pass, Aug 26 2026 - review by licensing attorney before operational use',
       'Research pass 2026-08-26 (Anthropic Advanced Research) - NOT legal sign-off; review by licensing attorney before operational use.'
       || CASE r.abbreviation
            WHEN 'AL' THEN ' CAVEAT: commercial threshold (50000) LOW confidence - spot-check AL Licensing Board for General Contractors.'
            WHEN 'MD' THEN ' CAVEAT: mold remediation status under MHIC unconfirmed - spot-check MD Home Improvement Commission.'
            WHEN 'IL' THEN ' CAVEAT: mold registration law passed but NOT yet enforceable (IDPH rulemaking pending) - not a hard gate yet.'
            WHEN 'TX' THEN ' NOTE: individual worker mold licensing required as of 9/1/2025 (TDLR SB 1255) - newer than most states, do not overwrite.'
            ELSE ''
          END,
       now()
FROM research r
ON CONFLICT (state) DO UPDATE SET
  abbreviation = EXCLUDED.abbreviation,
  tier = EXCLUDED.tier,
  priority_rank = EXCLUDED.priority_rank,
  snow_vertical = EXCLUDED.snow_vertical,
  deli_oven_market_density = EXCLUDED.deli_oven_market_density,
  handyman_license_status = EXCLUDED.handyman_license_status,
  handyman_threshold_usd = EXCLUDED.handyman_threshold_usd,
  handyman_city_county_override_notes = EXCLUDED.handyman_city_county_override_notes,
  pest_control_license_required = EXCLUDED.pest_control_license_required,
  pest_control_agency = EXCLUDED.pest_control_agency,
  biohazard_license_required_notes = EXCLUDED.biohazard_license_required_notes,
  restoration_threshold_usd = EXCLUDED.restoration_threshold_usd,
  mold_remediation_specific_license_notes = EXCLUDED.mold_remediation_specific_license_notes,
  confidence = EXCLUDED.confidence,
  handyman_license_gate = EXCLUDED.handyman_license_gate,
  specialty_license_gate = EXCLUDED.specialty_license_gate,
  verified = EXCLUDED.verified,
  last_verified_date = EXCLUDED.last_verified_date,
  source = EXCLUDED.source,
  notes = EXCLUDED.notes,
  updated_at = now();
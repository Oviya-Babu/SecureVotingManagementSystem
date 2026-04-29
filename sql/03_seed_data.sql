-- ============================================================
-- 03_seed_data.sql
-- Seed data: Regions, Constituencies, Parties, Election, Candidates, Voters
-- ============================================================

USE SecureVotingSystem;

-- ============================================================
-- REGIONS (6 regions)
-- ============================================================
INSERT INTO Region (RegionName) VALUES
('Northern Region'),
('Southern Region'),
('Eastern Region'),
('Western Region'),
('Central Region'),
('Coastal Region');

-- ============================================================
-- CONSTITUENCIES (36 total — 6 per region)
-- ============================================================
INSERT INTO Constituency (ConstituencyName, RegionID) VALUES
-- Northern Region (RegionID=1)
('Northgate',    1), ('Hillcrest',   1), ('Pinewood',    1),
('Lakeside',     1), ('Maplewood',   1), ('Riverdale',   1),
-- Southern Region (RegionID=2)
('Southbrook',   2), ('Sunridge',    2), ('Palmview',    2),
('Greenfield',   2), ('Clearwater',  2), ('Meadowvale',  2),
-- Eastern Region (RegionID=3)
('Eastport',     3), ('Stonehaven',  3), ('Ironbridge',  3),
('Harborview',   3), ('Crestwood',   3), ('Bayshore',    3),
-- Western Region (RegionID=4)
('Westfield',    4), ('Silverstone', 4), ('Oakdale',     4),
('Cedarville',   4), ('Elmwood',     4), ('Fairview',    4),
-- Central Region (RegionID=5)
('Centropolis',  5), ('Midtown',     5), ('Crossroads',  5),
('Heartland',    5), ('Unionville',  5), ('Bridgeport',  5),
-- Coastal Region (RegionID=6)
('Seacliff',     6), ('Tidehaven',   6), ('Coralport',   6),
('Wavecrest',    6), ('Sandbar',     6), ('Lighthouse',  6);

-- ============================================================
-- POLITICAL PARTIES (5 + NOTA)
-- ============================================================
INSERT INTO PoliticalParty (PartyCode, PartyName, PartySymbol, PartyColor) VALUES
('TSV',  'Tricolor Seva Vikas',       'lotus.png',    '#FF6B35'),
('PVM',  'Praja Vikas Manch',         'hand.png',     '#1A3A8F'),
('PAS',  'Progressive Alliance Seva', 'star.png',     '#16803C'),
('PRO',  'Peoples Reform Organisation','wheel.png',   '#8B5CF6'),
('NVM',  'National Vikas Movement',   'torch.png',    '#DC2626'),
('NOTA', 'None of the Above',         'nota.png',     '#6B7280');

-- ============================================================
-- ELECTION
-- ============================================================
INSERT INTO Election (ElectionID, ElectionName, ElectionType, StartTime, EndTime, Status) VALUES
(1, 'State Assembly Election 2025', 'State Assembly', '2025-04-15 07:00:00', '2025-04-15 18:00:00', 'Active');

-- ============================================================
-- CANDIDATES (96 real + 36 NOTA = 132 rows)
-- 3 real candidates + 1 NOTA per constituency
-- Parties cycle: TSV, PVM, PAS, PRO, NVM across constituencies
-- ============================================================

-- Helper: candidate names pool
-- We'll insert 3 real candidates per constituency (IDs 1-36 for constituency 1-36)
-- and 1 NOTA per constituency

INSERT INTO Candidate (CandidateName, PartyID, ConstituencyID, ElectionID, Age, Education, IsNOTA) VALUES
-- Constituency 1: Northgate
('Arjun Sharma',      1, 1, 1, 52, 'M.A. Political Science', 0),
('Priya Nair',        2, 1, 1, 45, 'B.Com, LLB',             0),
('Ravi Verma',        3, 1, 1, 38, 'MBA',                    0),
('NOTA',              6, 1, 1, NULL, NULL,                   1),
-- Constituency 2: Hillcrest
('Sunita Patel',      2, 2, 1, 49, 'M.Sc Economics',         0),
('Deepak Rao',        3, 2, 1, 55, 'B.Tech, MBA',            0),
('Kavitha Menon',     4, 2, 1, 41, 'MA History',             0),
('NOTA',              6, 2, 1, NULL, NULL,                   1),
-- Constituency 3: Pinewood
('Mohan Das',         3, 3, 1, 60, 'PhD Political Science',  0),
('Anita Singh',       4, 3, 1, 44, 'B.A. Sociology',         0),
('Vijay Kumar',       5, 3, 1, 37, 'LLB',                    0),
('NOTA',              6, 3, 1, NULL, NULL,                   1),
-- Constituency 4: Lakeside
('Rekha Iyer',        4, 4, 1, 53, 'M.Com',                  0),
('Suresh Pillai',     5, 4, 1, 48, 'B.Sc, MBA',              0),
('Nalini Reddy',      1, 4, 1, 39, 'MA Economics',           0),
('NOTA',              6, 4, 1, NULL, NULL,                   1),
-- Constituency 5: Maplewood
('Harish Gupta',      5, 5, 1, 57, 'B.A. Political Science', 0),
('Meena Krishnan',    1, 5, 1, 43, 'M.Sc Statistics',        0),
('Arun Bose',         2, 5, 1, 36, 'MBA Finance',            0),
('NOTA',              6, 5, 1, NULL, NULL,                   1),
-- Constituency 6: Riverdale
('Lakshmi Devi',      1, 6, 1, 51, 'MA Public Admin',        0),
('Rajesh Nambiar',    2, 6, 1, 46, 'B.Tech',                 0),
('Shalini Mishra',    3, 6, 1, 40, 'LLM',                    0),
('NOTA',              6, 6, 1, NULL, NULL,                   1),
-- Constituency 7: Southbrook
('Venkat Subramanian',2, 7, 1, 54, 'PhD Economics',          0),
('Pooja Sharma',      3, 7, 1, 42, 'MBA HR',                 0),
('Dinesh Yadav',      4, 7, 1, 35, 'B.A. History',           0),
('NOTA',              6, 7, 1, NULL, NULL,                   1),
-- Constituency 8: Sunridge
('Geeta Pillai',      3, 8, 1, 58, 'M.A. Sociology',         0),
('Ramesh Tiwari',     4, 8, 1, 47, 'B.Com LLB',              0),
('Usha Nair',         5, 8, 1, 33, 'MBA Marketing',          0),
('NOTA',              6, 8, 1, NULL, NULL,                   1),
-- Constituency 9: Palmview
('Sunil Mehta',       4, 9, 1, 56, 'B.Sc Engineering',       0),
('Ananya Krishnan',   5, 9, 1, 44, 'MA Political Science',   0),
('Prakash Reddy',     1, 9, 1, 38, 'LLB',                    0),
('NOTA',              6, 9, 1, NULL, NULL,                   1),
-- Constituency 10: Greenfield
('Radha Menon',       5, 10, 1, 50, 'M.Com Finance',         0),
('Kiran Patel',       1, 10, 1, 45, 'MBA Operations',        0),
('Santosh Rao',       2, 10, 1, 39, 'B.A. Economics',        0),
('NOTA',              6, 10, 1, NULL, NULL,                  1),
-- Constituency 11: Clearwater
('Bhavana Iyer',      1, 11, 1, 53, 'MA History',            0),
('Naresh Kumar',      2, 11, 1, 48, 'B.Tech MBA',            0),
('Divya Singh',       3, 11, 1, 36, 'LLB',                   0),
('NOTA',              6, 11, 1, NULL, NULL,                  1),
-- Constituency 12: Meadowvale
('Ashok Verma',       2, 12, 1, 61, 'PhD History',           0),
('Nirmala Devi',      3, 12, 1, 46, 'MA Sociology',          0),
('Suresh Babu',       4, 12, 1, 37, 'B.Com',                 0),
('NOTA',              6, 12, 1, NULL, NULL,                  1),
-- Constituency 13: Eastport
('Pradeep Nair',      3, 13, 1, 55, 'M.Sc Economics',        0),
('Kamala Reddy',      4, 13, 1, 43, 'MBA Finance',           0),
('Vinod Sharma',      5, 13, 1, 38, 'LLM',                   0),
('NOTA',              6, 13, 1, NULL, NULL,                  1),
-- Constituency 14: Stonehaven
('Saroja Pillai',     4, 14, 1, 57, 'MA Political Science',  0),
('Mahesh Gupta',      5, 14, 1, 49, 'B.A. History',          0),
('Leela Krishnan',    1, 14, 1, 34, 'MBA HR',                0),
('NOTA',              6, 14, 1, NULL, NULL,                  1),
-- Constituency 15: Ironbridge
('Rajan Menon',       5, 15, 1, 52, 'B.Tech',                0),
('Sudha Rao',         1, 15, 1, 44, 'MA Economics',          0),
('Anil Tiwari',       2, 15, 1, 40, 'LLB',                   0),
('NOTA',              6, 15, 1, NULL, NULL,                  1),
-- Constituency 16: Harborview
('Meenakshi Iyer',    1, 16, 1, 59, 'PhD Sociology',         0),
('Gopal Sharma',      2, 16, 1, 47, 'MBA Marketing',         0),
('Padma Nair',        3, 16, 1, 35, 'B.Com LLB',             0),
('NOTA',              6, 16, 1, NULL, NULL,                  1),
-- Constituency 17: Crestwood
('Balaji Reddy',      2, 17, 1, 54, 'M.Sc Statistics',       0),
('Chitra Patel',      3, 17, 1, 42, 'MA History',            0),
('Sanjay Kumar',      4, 17, 1, 37, 'B.A. Political Science',0),
('NOTA',              6, 17, 1, NULL, NULL,                  1),
-- Constituency 18: Bayshore
('Vimala Krishnan',   3, 18, 1, 56, 'MA Public Admin',       0),
('Ramakrishna Rao',   4, 18, 1, 48, 'B.Tech MBA',            0),
('Shobha Menon',      5, 18, 1, 33, 'LLM',                   0),
('NOTA',              6, 18, 1, NULL, NULL,                  1),
-- Constituency 19: Westfield
('Narayana Pillai',   4, 19, 1, 60, 'PhD Economics',         0),
('Savitha Devi',      5, 19, 1, 45, 'MBA Finance',           0),
('Mohan Verma',       1, 19, 1, 38, 'B.A. Sociology',        0),
('NOTA',              6, 19, 1, NULL, NULL,                  1),
-- Constituency 20: Silverstone
('Indira Sharma',     5, 20, 1, 53, 'MA Economics',          0),
('Krishnamurthy',     1, 20, 1, 49, 'LLB',                   0),
('Parvathi Nair',     2, 20, 1, 36, 'MBA Operations',        0),
('NOTA',              6, 20, 1, NULL, NULL,                  1),
-- Constituency 21: Oakdale
('Subramaniam Iyer',  1, 21, 1, 57, 'M.Com',                 0),
('Geetha Reddy',      2, 21, 1, 44, 'MA Political Science',  0),
('Bhaskar Rao',       3, 21, 1, 39, 'B.Tech',                0),
('NOTA',              6, 21, 1, NULL, NULL,                  1),
-- Constituency 22: Cedarville
('Malathi Pillai',    2, 22, 1, 55, 'PhD Political Science', 0),
('Venkatesh Kumar',   3, 22, 1, 47, 'MBA HR',                0),
('Saraswathi Devi',   4, 22, 1, 34, 'B.A. History',          0),
('NOTA',              6, 22, 1, NULL, NULL,                  1),
-- Constituency 23: Elmwood
('Chandrasekhar',     3, 23, 1, 58, 'MA Sociology',          0),
('Rohini Menon',      4, 23, 1, 46, 'B.Com LLB',             0),
('Jagannath Sharma',  5, 23, 1, 37, 'MBA Marketing',         0),
('NOTA',              6, 23, 1, NULL, NULL,                  1),
-- Constituency 24: Fairview
('Kamakshi Nair',     4, 24, 1, 52, 'M.Sc Economics',        0),
('Srinivasan Rao',    5, 24, 1, 48, 'LLM',                   0),
('Bhagyalakshmi',     1, 24, 1, 35, 'MA History',            0),
('NOTA',              6, 24, 1, NULL, NULL,                  1),
-- Constituency 25: Centropolis
('Damodaran Pillai',  5, 25, 1, 61, 'PhD History',           0),
('Vasantha Devi',     1, 25, 1, 43, 'MBA Finance',           0),
('Muralidharan',      2, 25, 1, 38, 'B.A. Political Science',0),
('NOTA',              6, 25, 1, NULL, NULL,                  1),
-- Constituency 26: Midtown
('Sarojini Krishnan', 1, 26, 1, 54, 'MA Public Admin',       0),
('Gopinath Sharma',   2, 26, 1, 46, 'B.Tech MBA',            0),
('Thulasi Reddy',     3, 26, 1, 39, 'LLB',                   0),
('NOTA',              6, 26, 1, NULL, NULL,                  1),
-- Constituency 27: Crossroads
('Padmanabhan Iyer',  2, 27, 1, 56, 'M.Sc Statistics',       0),
('Kalyani Nair',      3, 27, 1, 44, 'MA Economics',          0),
('Raghunath Verma',   4, 27, 1, 37, 'B.Com',                 0),
('NOTA',              6, 27, 1, NULL, NULL,                  1),
-- Constituency 28: Heartland
('Sumathi Pillai',    3, 28, 1, 59, 'PhD Economics',         0),
('Narayanan Rao',     4, 28, 1, 47, 'MBA Operations',        0),
('Girija Menon',      5, 28, 1, 34, 'B.A. Sociology',        0),
('NOTA',              6, 28, 1, NULL, NULL,                  1),
-- Constituency 29: Unionville
('Krishnakumar',      4, 29, 1, 53, 'MA Political Science',  0),
('Ambika Sharma',     5, 29, 1, 45, 'LLM',                   0),
('Parameswaran',      1, 29, 1, 38, 'B.Tech',                0),
('NOTA',              6, 29, 1, NULL, NULL,                  1),
-- Constituency 30: Bridgeport
('Saradha Devi',      5, 30, 1, 57, 'MA History',            0),
('Balasubramanian',   1, 30, 1, 49, 'MBA Finance',           0),
('Meenambika Nair',   2, 30, 1, 36, 'B.Com LLB',             0),
('NOTA',              6, 30, 1, NULL, NULL,                  1),
-- Constituency 31: Seacliff
('Radhakrishnan',     1, 31, 1, 60, 'PhD Political Science', 0),
('Vijayalakshmi',     2, 31, 1, 44, 'MA Sociology',          0),
('Sugumar Pillai',    3, 31, 1, 37, 'B.A. Economics',        0),
('NOTA',              6, 31, 1, NULL, NULL,                  1),
-- Constituency 32: Tidehaven
('Annamalai Rao',     2, 32, 1, 55, 'M.Sc Economics',        0),
('Karpagam Devi',     3, 32, 1, 43, 'MBA HR',                0),
('Selvakumar',        4, 32, 1, 38, 'LLB',                   0),
('NOTA',              6, 32, 1, NULL, NULL,                  1),
-- Constituency 33: Coralport
('Thilagavathi',      3, 33, 1, 52, 'MA Public Admin',       0),
('Murugesan Sharma',  4, 33, 1, 48, 'B.Tech MBA',            0),
('Kaveri Krishnan',   5, 33, 1, 35, 'MA Economics',          0),
('NOTA',              6, 33, 1, NULL, NULL,                  1),
-- Constituency 34: Wavecrest
('Palanisamy',        4, 34, 1, 58, 'PhD Sociology',         0),
('Rukmini Nair',      5, 34, 1, 46, 'B.Com',                 0),
('Shanmugam Iyer',    1, 34, 1, 39, 'MBA Marketing',         0),
('NOTA',              6, 34, 1, NULL, NULL,                  1),
-- Constituency 35: Sandbar
('Venkataramaiah',    5, 35, 1, 54, 'MA History',            0),
('Soundarya Pillai',  1, 35, 1, 42, 'LLM',                   0),
('Arumugam Reddy',    2, 35, 1, 37, 'B.A. Political Science',0),
('NOTA',              6, 35, 1, NULL, NULL,                  1),
-- Constituency 36: Lighthouse
('Mahalakshmi Rao',   1, 36, 1, 56, 'M.Sc Statistics',       0),
('Thiruvengadam',     2, 36, 1, 47, 'MBA Finance',           0),
('Ponnammal Devi',    3, 36, 1, 34, 'B.A. Sociology',        0),
('NOTA',              6, 36, 1, NULL, NULL,                  1);

-- ============================================================
-- VOTERS (732 voters — ~20-21 per constituency)
-- AadhaarNumber: 9000000XXXXX (12 digits)
-- FingerprintHash: SHA2(CONCAT('FP_SALT_2025_', AadhaarNumber), 256)
-- ============================================================

-- We'll use a stored procedure to generate voters efficiently
DELIMITER $$

CREATE PROCEDURE sp_GenerateVoters()
BEGIN
    DECLARE v_id INT DEFAULT 1;
    DECLARE c_id INT;
    DECLARE aadhaar CHAR(12);
    DECLARE fp_hash VARCHAR(64);
    DECLARE voter_name VARCHAR(150);
    DECLARE dob DATE;
    DECLARE gender ENUM('Male','Female','Other');
    
    -- Name pools
    DECLARE first_names_m VARCHAR(500) DEFAULT 'Arjun,Ravi,Suresh,Mohan,Vijay,Rajesh,Anil,Deepak,Sanjay,Mahesh,Naresh,Ramesh,Dinesh,Sunil,Kiran,Ashok,Pradeep,Vinod,Arun,Balaji';
    DECLARE first_names_f VARCHAR(500) DEFAULT 'Priya,Sunita,Anita,Rekha,Meena,Lakshmi,Geeta,Radha,Kavitha,Nirmala,Kamala,Saroja,Sudha,Meenakshi,Chitra,Vimala,Savitha,Indira,Geetha,Malathi';
    DECLARE last_names VARCHAR(500) DEFAULT 'Sharma,Patel,Nair,Reddy,Iyer,Pillai,Rao,Verma,Kumar,Singh,Gupta,Menon,Krishnan,Tiwari,Mehta,Devi,Bose,Mishra,Yadav,Das';
    
    WHILE v_id <= 732 DO
        SET c_id = ((v_id - 1) MOD 36) + 1;
        SET aadhaar = LPAD(CAST(900000000000 + v_id AS CHAR), 12, '0');
        SET fp_hash = SHA2(CONCAT('FP_SALT_2025_', aadhaar), 256);
        
        -- Alternate gender
        IF (v_id MOD 2) = 0 THEN
            SET gender = 'Female';
            SET voter_name = CONCAT(
                ELT(((v_id - 1) MOD 20) + 1, 'Priya','Sunita','Anita','Rekha','Meena','Lakshmi','Geeta','Radha','Kavitha','Nirmala','Kamala','Saroja','Sudha','Meenakshi','Chitra','Vimala','Savitha','Indira','Geetha','Malathi'),
                ' ',
                ELT(((v_id - 1) MOD 20) + 1, 'Sharma','Patel','Nair','Reddy','Iyer','Pillai','Rao','Verma','Kumar','Singh','Gupta','Menon','Krishnan','Tiwari','Mehta','Devi','Bose','Mishra','Yadav','Das')
            );
        ELSE
            SET gender = 'Male';
            SET voter_name = CONCAT(
                ELT(((v_id - 1) MOD 20) + 1, 'Arjun','Ravi','Suresh','Mohan','Vijay','Rajesh','Anil','Deepak','Sanjay','Mahesh','Naresh','Ramesh','Dinesh','Sunil','Kiran','Ashok','Pradeep','Vinod','Arun','Balaji'),
                ' ',
                ELT((v_id MOD 20) + 1, 'Sharma','Patel','Nair','Reddy','Iyer','Pillai','Rao','Verma','Kumar','Singh','Gupta','Menon','Krishnan','Tiwari','Mehta','Devi','Bose','Mishra','Yadav','Das')
            );
        END IF;
        
        SET dob = DATE_SUB('2000-01-01', INTERVAL (18 + (v_id MOD 50)) YEAR);
        
        INSERT INTO Voter (VoterName, DateOfBirth, Gender, Address, ConstituencyID, IsActive)
        VALUES (voter_name, dob, gender, CONCAT('House No. ', v_id, ', Ward ', c_id), c_id, 1);
        
        INSERT INTO VoterIdentity (VoterID, AadhaarNumber, FingerprintHash)
        VALUES (v_id, aadhaar, fp_hash);
        
        SET v_id = v_id + 1;
    END WHILE;
END$$

DELIMITER ;

CALL sp_GenerateVoters();
DROP PROCEDURE IF EXISTS sp_GenerateVoters;

-- ============================================================
-- RESULT TABLE — Initialize with 0 votes for all candidates
-- ============================================================
INSERT INTO Result (ElectionID, ConstituencyID, CandidateID, VoteCount, IsWinner)
SELECT 1, c.ConstituencyID, c.CandidateID, 0, 0
FROM Candidate c
WHERE c.ElectionID = 1;

-- ============================================================
-- ELECTION SCHEDULE
-- ============================================================
INSERT INTO ElectionSchedule (ElectionID, ConstituencyID, StartTime, EndTime)
SELECT 1, ConstituencyID, '2025-04-15 07:00:00', '2025-04-15 18:00:00'
FROM Constituency;

-- ============================================================
-- SYSTEM CONFIG
-- ============================================================
INSERT INTO SystemConfig (ConfigKey, ConfigValue) VALUES
('ELECTION_STATUS', 'Active'),
('SIMULATION_DONE', 'false'),
('WINNERS_MARKED',  'false'),
('VERSION',         '1.0');

-- ============================================================
-- OFFICER (Admin user)
-- ============================================================
INSERT INTO Officer (OfficerName, Role, Username, PasswordHash, IsActive) VALUES
('System Administrator', 'Admin',   'admin',   SHA2('Admin@2025', 256), 1),
('Election Officer',     'Officer', 'officer', SHA2('Officer@2025', 256), 1),
('Audit Officer',        'Auditor', 'auditor', SHA2('Auditor@2025', 256), 1);

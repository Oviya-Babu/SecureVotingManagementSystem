-- ============================================================
-- 05_procedures.sql
-- 6 Stored Procedures for SecureVotingSystem
-- ============================================================

USE SecureVotingSystem;

DELIMITER $$

-- ============================================================
-- PROCEDURE 1: sp_CastVote
-- Validates and inserts a vote with full error handling
-- Layer 2 duplicate prevention (Layer 1 = UNIQUE constraint,
-- Layer 3 = route pre-check with FOR UPDATE)
-- ============================================================
DROP PROCEDURE IF EXISTS sp_CastVote$$
CREATE PROCEDURE sp_CastVote(
    IN p_VoterID     INT,
    IN p_CandidateID INT,
    IN p_ElectionID  INT,
    IN p_ReceiptHash VARCHAR(64),
    OUT p_VoteID     INT,
    OUT p_Message    VARCHAR(200)
)
BEGIN
    DECLARE v_IsActive      TINYINT DEFAULT 0;
    DECLARE v_ConstVoter    INT DEFAULT 0;
    DECLARE v_ConstCand     INT DEFAULT 0;
    DECLARE v_ElecStatus    VARCHAR(20) DEFAULT '';
    DECLARE v_AlreadyVoted  INT DEFAULT 0;
    DECLARE v_IsNOTA        TINYINT DEFAULT 0;

    -- Check voter exists and is active
    SELECT IsActive, ConstituencyID
    INTO v_IsActive, v_ConstVoter
    FROM Voter WHERE VoterID = p_VoterID;

    IF v_IsActive IS NULL THEN
        SET p_VoteID = 0;
        SET p_Message = 'VOTER_NOT_FOUND';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VOTER_NOT_FOUND: Voter not found or inactive.';
    END IF;

    IF v_IsActive = 0 THEN
        SET p_VoteID = 0;
        SET p_Message = 'VOTER_INACTIVE';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VOTER_INACTIVE: This voter account has been deactivated.';
    END IF;

    -- Check election is active
    SELECT Status INTO v_ElecStatus FROM Election WHERE ElectionID = p_ElectionID;
    IF v_ElecStatus <> 'Active' THEN
        SET p_VoteID = 0;
        SET p_Message = 'ELECTION_CLOSED';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ELECTION_CLOSED: Voting is currently closed.';
    END IF;

    -- Check candidate exists and get constituency
    SELECT ConstituencyID, IsNOTA INTO v_ConstCand, v_IsNOTA
    FROM Candidate WHERE CandidateID = p_CandidateID AND ElectionID = p_ElectionID;

    IF v_ConstCand IS NULL THEN
        SET p_VoteID = 0;
        SET p_Message = 'CANDIDATE_NOT_FOUND';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CANDIDATE_NOT_FOUND: Candidate not found.';
    END IF;

    -- Check constituency match
    IF v_ConstVoter <> v_ConstCand THEN
        SET p_VoteID = 0;
        SET p_Message = 'CONSTITUENCY_MISMATCH';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CONSTITUENCY_MISMATCH: You can only vote for candidates in your constituency.';
    END IF;

    -- Layer 2: Check duplicate vote
    SELECT COUNT(*) INTO v_AlreadyVoted
    FROM Vote WHERE VoterID = p_VoterID AND ElectionID = p_ElectionID;

    IF v_AlreadyVoted > 0 THEN
        SET p_VoteID = 0;
        SET p_Message = 'ALREADY_VOTED';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ALREADY_VOTED: Vote already recorded. Duplicate voting is not allowed.';
    END IF;

    -- Insert the vote
    INSERT INTO Vote (VoterID, CandidateID, ElectionID, ReceiptHash)
    VALUES (p_VoterID, p_CandidateID, p_ElectionID, p_ReceiptHash);

    SET p_VoteID = LAST_INSERT_ID();
    SET p_Message = 'SUCCESS';
END$$


-- ============================================================
-- PROCEDURE 2: sp_AuthenticateVoter
-- Combined Aadhaar + fingerprint verification
-- ============================================================
DROP PROCEDURE IF EXISTS sp_AuthenticateVoter$$
CREATE PROCEDURE sp_AuthenticateVoter(
    IN  p_AadhaarNumber VARCHAR(12),
    IN  p_FPSalt        VARCHAR(50),
    OUT p_VoterID       INT,
    OUT p_VoterName     VARCHAR(150),
    OUT p_ConstituencyID INT,
    OUT p_ConstituencyName VARCHAR(150),
    OUT p_HasVoted      TINYINT,
    OUT p_Message       VARCHAR(200)
)
BEGIN
    DECLARE v_StoredHash    VARCHAR(64);
    DECLARE v_ComputedHash  VARCHAR(64);
    DECLARE v_IsActive      TINYINT;

    -- Find voter by Aadhaar
    SELECT vi.VoterID, v.VoterName, v.ConstituencyID, con.ConstituencyName,
           vi.FingerprintHash, v.IsActive
    INTO p_VoterID, p_VoterName, p_ConstituencyID, p_ConstituencyName,
         v_StoredHash, v_IsActive
    FROM VoterIdentity vi
    JOIN Voter v ON vi.VoterID = v.VoterID
    JOIN Constituency con ON v.ConstituencyID = con.ConstituencyID
    WHERE vi.AadhaarNumber = p_AadhaarNumber;

    IF p_VoterID IS NULL THEN
        SET p_Message = 'AADHAAR_NOT_FOUND';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AADHAAR_NOT_FOUND: Invalid Aadhaar Number.';
    END IF;

    IF v_IsActive = 0 THEN
        SET p_Message = 'VOTER_INACTIVE';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VOTER_INACTIVE: This voter account has been deactivated.';
    END IF;

    -- Check if already voted
    SELECT fn_HasVoted(p_VoterID, 1) INTO p_HasVoted;

    -- Verify fingerprint
    SET v_ComputedHash = SHA2(CONCAT(p_FPSalt, p_AadhaarNumber), 256);
    IF v_ComputedHash <> v_StoredHash THEN
        SET p_Message = 'BIOMETRIC_MISMATCH';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BIOMETRIC_MISMATCH: Fingerprint does not match.';
    END IF;

    SET p_Message = 'SUCCESS';
END$$


-- ============================================================
-- PROCEDURE 3: sp_SimulateBulkVotes
-- Cursor-based bulk vote generation for demo mode
-- ============================================================
DROP PROCEDURE IF EXISTS sp_SimulateBulkVotes$$
CREATE PROCEDURE sp_SimulateBulkVotes(IN p_ElectionID INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_VoterID       INT;
    DECLARE v_ConstID       INT;
    DECLARE v_CandidateID   INT;
    DECLARE v_ReceiptHash   VARCHAR(64);
    DECLARE v_AlreadyVoted  INT;
    DECLARE v_CandCount     INT;
    DECLARE v_RandIdx       INT;

    -- Cursor over all active voters who haven't voted
    DECLARE voter_cursor CURSOR FOR
        SELECT v.VoterID, v.ConstituencyID
        FROM Voter v
        WHERE v.IsActive = 1
          AND v.VoterID NOT IN (
              SELECT VoterID FROM Vote WHERE ElectionID = p_ElectionID
          );

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN voter_cursor;

    vote_loop: LOOP
        FETCH voter_cursor INTO v_VoterID, v_ConstID;
        IF done THEN LEAVE vote_loop; END IF;

        -- Count non-NOTA candidates in this constituency
        SELECT COUNT(*) INTO v_CandCount
        FROM Candidate
        WHERE ConstituencyID = v_ConstID
          AND ElectionID = p_ElectionID
          AND IsNOTA = 0;

        -- 10% chance of NOTA, else random real candidate
        IF (RAND() < 0.10) THEN
            -- Pick NOTA candidate
            SELECT CandidateID INTO v_CandidateID
            FROM Candidate
            WHERE ConstituencyID = v_ConstID
              AND ElectionID = p_ElectionID
              AND IsNOTA = 1
            LIMIT 1;
        ELSE
            -- Pick random real candidate
            SET v_RandIdx = FLOOR(RAND() * v_CandCount) + 1;
            SELECT CandidateID INTO v_CandidateID
            FROM Candidate
            WHERE ConstituencyID = v_ConstID
              AND ElectionID = p_ElectionID
              AND IsNOTA = 0
            ORDER BY CandidateID
            LIMIT 1 OFFSET (v_RandIdx - 1);
        END IF;

        -- Generate receipt hash
        SET v_ReceiptHash = SHA2(
            CONCAT(v_VoterID, '|', v_CandidateID, '|', p_ElectionID, '|', NOW()),
            256
        );

        -- Insert vote (trigger will update Result table)
        INSERT IGNORE INTO Vote (VoterID, CandidateID, ElectionID, ReceiptHash)
        VALUES (v_VoterID, v_CandidateID, p_ElectionID, v_ReceiptHash);

    END LOOP;

    CLOSE voter_cursor;

    -- Log simulation
    INSERT INTO AuditLog (TableName, Action, RecordID, Details)
    VALUES ('Vote', 'SIMULATE', p_ElectionID,
            CONCAT('Bulk simulation completed for ElectionID=', p_ElectionID));
END$$


-- ============================================================
-- PROCEDURE 4: sp_MarkWinners
-- Marks one winner per constituency with tie-breaking by CandidateID
-- ============================================================
DROP PROCEDURE IF EXISTS sp_MarkWinners$$
CREATE PROCEDURE sp_MarkWinners(IN p_ElectionID INT)
BEGIN
    -- Reset all winners first
    UPDATE Result SET IsWinner = 0 WHERE ElectionID = p_ElectionID;

    -- Mark winner per constituency (highest votes, tie-break by CandidateID)
    UPDATE Result r
    JOIN (
        SELECT r2.ConstituencyID,
               r2.CandidateID,
               r2.VoteCount
        FROM Result r2
        WHERE r2.ElectionID = p_ElectionID
          AND r2.VoteCount = (
              SELECT MAX(r3.VoteCount)
              FROM Result r3
              WHERE r3.ElectionID = p_ElectionID
                AND r3.ConstituencyID = r2.ConstituencyID
          )
        ORDER BY r2.ConstituencyID, r2.CandidateID
    ) winners ON r.ConstituencyID = winners.ConstituencyID
              AND r.CandidateID = winners.CandidateID
              AND r.ElectionID = p_ElectionID
    SET r.IsWinner = 1;

    -- Log
    INSERT INTO AuditLog (TableName, Action, RecordID, Details)
    VALUES ('Result', 'MARK_WINNERS', p_ElectionID,
            CONCAT('Winners marked for ElectionID=', p_ElectionID));
END$$


-- ============================================================
-- PROCEDURE 5: sp_GetFinalResults
-- Party-wise seat count and vote share
-- ============================================================
DROP PROCEDURE IF EXISTS sp_GetFinalResults$$
CREATE PROCEDURE sp_GetFinalResults(IN p_ElectionID INT)
BEGIN
    SELECT
        pp.PartyID,
        pp.PartyCode,
        pp.PartyName,
        pp.PartyColor,
        COUNT(CASE WHEN r.IsWinner = 1 THEN 1 END) AS SeatsWon,
        COALESCE(SUM(r.VoteCount), 0)               AS TotalVotes,
        ROUND(
            COALESCE(SUM(r.VoteCount), 0) * 100.0 /
            NULLIF((SELECT SUM(VoteCount) FROM Result WHERE ElectionID = p_ElectionID), 0),
            2
        ) AS VoteSharePct
    FROM PoliticalParty pp
    LEFT JOIN Candidate c  ON pp.PartyID = c.PartyID AND c.ElectionID = p_ElectionID
    LEFT JOIN Result r     ON c.CandidateID = r.CandidateID AND r.ElectionID = p_ElectionID
    GROUP BY pp.PartyID, pp.PartyCode, pp.PartyName, pp.PartyColor
    ORDER BY SeatsWon DESC, TotalVotes DESC;
END$$


-- ============================================================
-- PROCEDURE 6: sp_CursorDisplayWinners
-- Walks all 36 winners via cursor and returns result set
-- ============================================================
DROP PROCEDURE IF EXISTS sp_CursorDisplayWinners$$
CREATE PROCEDURE sp_CursorDisplayWinners(IN p_ElectionID INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_ConstID   INT;
    DECLARE v_ConstName VARCHAR(150);
    DECLARE v_CandName  VARCHAR(150);
    DECLARE v_PartyCode VARCHAR(10);
    DECLARE v_PartyName VARCHAR(150);
    DECLARE v_Votes     INT;
    DECLARE v_RegionName VARCHAR(100);

    -- Temp table to collect results
    DROP TEMPORARY TABLE IF EXISTS tmp_winners;
    CREATE TEMPORARY TABLE tmp_winners (
        ConstituencyID   INT,
        ConstituencyName VARCHAR(150),
        RegionName       VARCHAR(100),
        WinnerName       VARCHAR(150),
        PartyCode        VARCHAR(10),
        PartyName        VARCHAR(150),
        VoteCount        INT
    );

    DECLARE winner_cursor CURSOR FOR
        SELECT con.ConstituencyID, con.ConstituencyName, reg.RegionName,
               c.CandidateName, pp.PartyCode, pp.PartyName, r.VoteCount
        FROM Result r
        JOIN Candidate c    ON r.CandidateID = c.CandidateID
        JOIN Constituency con ON r.ConstituencyID = con.ConstituencyID
        JOIN Region reg     ON con.RegionID = reg.RegionID
        JOIN PoliticalParty pp ON c.PartyID = pp.PartyID
        WHERE r.ElectionID = p_ElectionID AND r.IsWinner = 1
        ORDER BY con.ConstituencyID;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN winner_cursor;
    winner_loop: LOOP
        FETCH winner_cursor INTO v_ConstID, v_ConstName, v_RegionName,
                                  v_CandName, v_PartyCode, v_PartyName, v_Votes;
        IF done THEN LEAVE winner_loop; END IF;

        INSERT INTO tmp_winners VALUES
            (v_ConstID, v_ConstName, v_RegionName, v_CandName, v_PartyCode, v_PartyName, v_Votes);
    END LOOP;
    CLOSE winner_cursor;

    SELECT * FROM tmp_winners ORDER BY ConstituencyID;
    DROP TEMPORARY TABLE IF EXISTS tmp_winners;
END$$

DELIMITER ;

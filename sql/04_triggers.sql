-- ============================================================
-- 04_triggers.sql
-- 5 Triggers for SecureVotingSystem
-- ============================================================

USE SecureVotingSystem;

DELIMITER $$

-- ============================================================
-- TRIGGER 1: trg_after_vote_insert
-- Auto-updates Result table when a vote is inserted
-- ============================================================
DROP TRIGGER IF EXISTS trg_after_vote_insert$$
CREATE TRIGGER trg_after_vote_insert
AFTER INSERT ON Vote
FOR EACH ROW
BEGIN
    -- Update or insert result count
    INSERT INTO Result (ElectionID, ConstituencyID, CandidateID, VoteCount, IsWinner)
    SELECT NEW.ElectionID, c.ConstituencyID, NEW.CandidateID, 1, 0
    FROM Candidate c WHERE c.CandidateID = NEW.CandidateID
    ON DUPLICATE KEY UPDATE VoteCount = VoteCount + 1;

    -- Log to AuditLog
    INSERT INTO AuditLog (TableName, Action, RecordID, Details)
    VALUES ('Vote', 'INSERT', NEW.VoteID,
            CONCAT('VoterID=', NEW.VoterID, ' voted for CandidateID=', NEW.CandidateID,
                   ' in ElectionID=', NEW.ElectionID));
END$$

-- ============================================================
-- TRIGGER 2: trg_before_vote_update
-- BLOCKS any UPDATE on Vote table (immutability)
-- ============================================================
DROP TRIGGER IF EXISTS trg_before_vote_update$$
CREATE TRIGGER trg_before_vote_update
BEFORE UPDATE ON Vote
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'VOTE_IMMUTABLE: Updates to cast votes are not permitted.';
END$$

-- ============================================================
-- TRIGGER 3: trg_before_vote_delete
-- BLOCKS any DELETE on Vote table (immutability)
-- ============================================================
DROP TRIGGER IF EXISTS trg_before_vote_delete$$
CREATE TRIGGER trg_before_vote_delete
BEFORE DELETE ON Vote
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'VOTE_IMMUTABLE: Deletion of cast votes is not permitted.';
END$$

-- ============================================================
-- TRIGGER 4: trg_after_voter_insert
-- Logs every voter registration to AuditLog
-- ============================================================
DROP TRIGGER IF EXISTS trg_after_voter_insert$$
CREATE TRIGGER trg_after_voter_insert
AFTER INSERT ON Voter
FOR EACH ROW
BEGIN
    INSERT INTO AuditLog (TableName, Action, RecordID, Details)
    VALUES ('Voter', 'INSERT', NEW.VoterID,
            CONCAT('New voter registered: ', NEW.VoterName,
                   ' in ConstituencyID=', NEW.ConstituencyID));
END$$

-- ============================================================
-- TRIGGER 5: trg_after_election_update
-- Logs every election status change to AuditLog
-- ============================================================
DROP TRIGGER IF EXISTS trg_after_election_update$$
CREATE TRIGGER trg_after_election_update
AFTER UPDATE ON Election
FOR EACH ROW
BEGIN
    IF OLD.Status <> NEW.Status THEN
        INSERT INTO AuditLog (TableName, Action, RecordID, Details)
        VALUES ('Election', 'UPDATE', NEW.ElectionID,
                CONCAT('Election status changed from ', OLD.Status, ' to ', NEW.Status));
    END IF;
END$$

DELIMITER ;

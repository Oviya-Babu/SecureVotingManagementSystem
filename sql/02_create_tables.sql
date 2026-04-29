-- ============================================================
-- 02_create_tables.sql
-- Create all 15 tables for SecureVotingSystem
-- ============================================================

USE SecureVotingSystem;

-- 1. Region
CREATE TABLE Region (
    RegionID    INT AUTO_INCREMENT PRIMARY KEY,
    RegionName  VARCHAR(100) NOT NULL UNIQUE
);

-- 2. Constituency
CREATE TABLE Constituency (
    ConstituencyID   INT AUTO_INCREMENT PRIMARY KEY,
    ConstituencyName VARCHAR(150) NOT NULL UNIQUE,
    RegionID         INT NOT NULL,
    FOREIGN KEY (RegionID) REFERENCES Region(RegionID)
);

-- 3. PoliticalParty
CREATE TABLE PoliticalParty (
    PartyID      INT AUTO_INCREMENT PRIMARY KEY,
    PartyCode    VARCHAR(10)  NOT NULL UNIQUE,
    PartyName    VARCHAR(150) NOT NULL,
    PartySymbol  VARCHAR(100),
    PartyColor   VARCHAR(20)
);

-- 4. Election
CREATE TABLE Election (
    ElectionID   INT AUTO_INCREMENT PRIMARY KEY,
    ElectionName VARCHAR(200) NOT NULL,
    ElectionType VARCHAR(50)  NOT NULL DEFAULT 'State Assembly',
    StartTime    DATETIME     NOT NULL,
    EndTime      DATETIME     NOT NULL,
    Status       ENUM('Scheduled','Active','Closed','ResultsDeclared') NOT NULL DEFAULT 'Active'
);

-- 5. ElectionSchedule
CREATE TABLE ElectionSchedule (
    ScheduleID     INT AUTO_INCREMENT PRIMARY KEY,
    ElectionID     INT NOT NULL,
    ConstituencyID INT NOT NULL,
    StartTime      DATETIME NOT NULL,
    EndTime        DATETIME NOT NULL,
    FOREIGN KEY (ElectionID)     REFERENCES Election(ElectionID),
    FOREIGN KEY (ConstituencyID) REFERENCES Constituency(ConstituencyID)
);

-- 6. Voter
CREATE TABLE Voter (
    VoterID        INT AUTO_INCREMENT PRIMARY KEY,
    VoterName      VARCHAR(150) NOT NULL,
    DateOfBirth    DATE         NOT NULL,
    Gender         ENUM('Male','Female','Other') NOT NULL,
    Address        VARCHAR(300),
    ConstituencyID INT NOT NULL,
    IsActive       TINYINT(1)   NOT NULL DEFAULT 1,
    RegisteredAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ConstituencyID) REFERENCES Constituency(ConstituencyID)
);

-- 7. VoterIdentity
CREATE TABLE VoterIdentity (
    IdentityID       INT AUTO_INCREMENT PRIMARY KEY,
    VoterID          INT          NOT NULL UNIQUE,
    AadhaarNumber    CHAR(12)     NOT NULL UNIQUE,
    FingerprintHash  VARCHAR(64)  NOT NULL,
    FOREIGN KEY (VoterID) REFERENCES Voter(VoterID)
);

-- 8. Candidate
CREATE TABLE Candidate (
    CandidateID    INT AUTO_INCREMENT PRIMARY KEY,
    CandidateName  VARCHAR(150) NOT NULL,
    PartyID        INT          NOT NULL,
    ConstituencyID INT          NOT NULL,
    ElectionID     INT          NOT NULL,
    Age            INT,
    Education      VARCHAR(100),
    IsNOTA         TINYINT(1)   NOT NULL DEFAULT 0,
    FOREIGN KEY (PartyID)        REFERENCES PoliticalParty(PartyID),
    FOREIGN KEY (ConstituencyID) REFERENCES Constituency(ConstituencyID),
    FOREIGN KEY (ElectionID)     REFERENCES Election(ElectionID)
);

-- 9. Vote
CREATE TABLE Vote (
    VoteID       INT AUTO_INCREMENT PRIMARY KEY,
    VoterID      INT      NOT NULL,
    CandidateID  INT      NOT NULL,
    ElectionID   INT      NOT NULL,
    VotedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ReceiptHash  VARCHAR(64),
    UNIQUE KEY uq_voter_election (VoterID, ElectionID),
    FOREIGN KEY (VoterID)     REFERENCES Voter(VoterID),
    FOREIGN KEY (CandidateID) REFERENCES Candidate(CandidateID),
    FOREIGN KEY (ElectionID)  REFERENCES Election(ElectionID)
);

-- 10. Result
CREATE TABLE Result (
    ResultID       INT AUTO_INCREMENT PRIMARY KEY,
    ElectionID     INT NOT NULL,
    ConstituencyID INT NOT NULL,
    CandidateID    INT NOT NULL,
    VoteCount      INT NOT NULL DEFAULT 0,
    IsWinner       TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_result (ElectionID, CandidateID),
    FOREIGN KEY (ElectionID)     REFERENCES Election(ElectionID),
    FOREIGN KEY (ConstituencyID) REFERENCES Constituency(ConstituencyID),
    FOREIGN KEY (CandidateID)    REFERENCES Candidate(CandidateID)
);

-- 11. Authentication
CREATE TABLE Authentication (
    AuthID        INT AUTO_INCREMENT PRIMARY KEY,
    VoterID       INT          NOT NULL,
    AadhaarNumber CHAR(12)     NOT NULL,
    AuthType      ENUM('Aadhaar','Biometric') NOT NULL,
    Status        ENUM('Success','Failed','Pending') NOT NULL DEFAULT 'Pending',
    IPAddress     VARCHAR(45),
    AttemptedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (VoterID) REFERENCES Voter(VoterID)
);

-- 12. AuditLog
CREATE TABLE AuditLog (
    LogID       INT AUTO_INCREMENT PRIMARY KEY,
    TableName   VARCHAR(100) NOT NULL,
    Action      VARCHAR(50)  NOT NULL,
    RecordID    INT,
    Details     TEXT,
    CreatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. Officer
CREATE TABLE Officer (
    OfficerID   INT AUTO_INCREMENT PRIMARY KEY,
    OfficerName VARCHAR(150) NOT NULL,
    Role        ENUM('Admin','Officer','Auditor') NOT NULL DEFAULT 'Officer',
    Username    VARCHAR(100) NOT NULL UNIQUE,
    PasswordHash VARCHAR(64) NOT NULL,
    IsActive    TINYINT(1)  NOT NULL DEFAULT 1,
    CreatedAt   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. OfficerSession
CREATE TABLE OfficerSession (
    SessionID   INT AUTO_INCREMENT PRIMARY KEY,
    OfficerID   INT          NOT NULL,
    Token       VARCHAR(128) NOT NULL UNIQUE,
    CreatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ExpiresAt   DATETIME     NOT NULL,
    FOREIGN KEY (OfficerID) REFERENCES Officer(OfficerID)
);

-- 15. SystemConfig
CREATE TABLE SystemConfig (
    ConfigKey   VARCHAR(100) PRIMARY KEY,
    ConfigValue VARCHAR(500) NOT NULL,
    UpdatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

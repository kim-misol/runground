erDiagram
  USER {
    string   id PK
    string   email UK "nullable"
    string   passwordHash "nullable"
    string   globalRole
    datetime createdAt
    datetime updatedAt
    datetime deletedAt "nullable"
  }

  USER_PROFILE {
    string userId PK,FK
    string name "nullable"
    string phone "nullable"
    string instagram "nullable"
  }

  USER_IDENTITY {
    string   id PK
    string   userId FK
    string   provider
    string   providerId
    datetime createdAt
    %% unique(provider, providerId)
  }

  CLASS {
    string   id PK
    string   mode
    string   title
    string   intro "nullable"
    string   createdById FK
    datetime createdAt
  }

  CLASS_MEMBERSHIP {
    string   id PK
    string   classId FK
    string   userId FK
    string   role
    string   staffRole "nullable"
    string   memberStatus
    string   runnerLevel "nullable"
    string   runnerGoal "nullable"
    datetime joinedAt
    %% unique(classId, userId)
  }

  CLASS_INVITATION {
    string   id PK
    string   classId FK
    string   email
    string   role
    string   staffRole "nullable"
    string   token UK
    datetime expiresAt
    datetime acceptedAt "nullable"
    string   acceptedByUserId "nullable"
    datetime createdAt
    %% index(classId, email)
  }

  TRAINING_EVENT {
    string   id PK
    string   classId FK
    string   kind
    string   title
    datetime startsAt "nullable"
    datetime endsAt "nullable"
    string   location "nullable"
    string   createdById FK
    datetime createdAt
    datetime updatedAt
  }

  TRAINING_DETAIL {
    string  id PK
    string  eventId FK
    string  section
    int     order
    string  type
    string  note "nullable"
    float   distanceKm "nullable"
    int     durationMin "nullable"
    int     reps "nullable"
    int     sets "nullable"
  }

  ATTENDANCE_VOTE {
    string   id PK
    string   eventId FK
    string   userId FK
    string   status
    datetime updatedAt
    %% unique(eventId, userId)
  }

  TRAINING_TEMPLATE_ITEM {
    string id PK
    string classId FK
    int    weekIndex
    int    dayOffset
    string type
    string title "nullable"
    string description "nullable"
    float  targetDistanceKm "nullable"
    int    targetDurationMin "nullable"
    int    targetPaceSecPerKm "nullable"
  }

  TRAINING_PROGRESS {
    string   id PK
    string   userId FK
    string   classId FK
    string   eventId "nullable"
    string   templateItemId "nullable"
    string   status
    string   note "nullable"
    datetime completedAt "nullable"
    %% NOTE: (eventId XOR templateItemId) 권장
  }

  ACTIVITY_RECORD {
    string   id PK
    string   userId FK
    string   classId "nullable"
    string   eventId "nullable"
    string   templateItemId "nullable"
    string   provider
    string   externalId "nullable"
    datetime startedAt
    int      durationSec "nullable"
    int      distanceM "nullable"
    int      avgPaceSecPerKm "nullable"
    int      avgHr "nullable"
    int      calories "nullable"
    json     rawJson "nullable"
    datetime createdAt
  }

  COACH_FEEDBACK {
    string   id PK
    string   activityId FK
    string   coachId FK
    string   content
    datetime createdAt
  }

  POST {
    string   id PK
    string   classId FK
    string   authorId FK
    string   content
    datetime createdAt
  }

  COMMENT {
    string   id PK
    string   postId FK
    string   authorId FK
    string   content
    datetime createdAt
  }

  MEDIA_ASSET {
    string   id PK
    string   classId FK
    string   eventId "nullable"
    string   uploaderId FK
    string   type
    string   url
    string   thumbnailUrl "nullable"
    datetime createdAt
  }

  PLAN {
    string id PK
    string scope
    string classId "nullable"
    string name
    int    price
    string currency
  }

  SUBSCRIPTION {
    string   id PK
    string   userId FK
    string   classId "nullable"
    string   planId FK
    string   status
    datetime startedAt
    datetime endsAt "nullable"
  }

  PAYMENT {
    string   id PK
    string   userId FK
    string   planId FK
    string   subscriptionId "nullable"
    string   status
    int      amount
    string   provider "nullable"
    string   providerPaymentId "nullable"
    datetime createdAt
  }

  ENTITLEMENT {
    string   id PK
    string   userId FK
    string   type
    datetime startsAt
    datetime endsAt "nullable"
  }

  %% ---------------- Relationships ----------------
  USER ||--o| USER_PROFILE : has
  USER ||--o{ USER_IDENTITY : has

  USER ||--o{ CLASS_MEMBERSHIP : joins
  CLASS ||--o{ CLASS_MEMBERSHIP : has

  CLASS ||--o{ CLASS_INVITATION : invites
  USER  ||--o{ CLASS : creates

  CLASS ||--o{ TRAINING_EVENT : schedules
  USER  ||--o{ TRAINING_EVENT : creates

  TRAINING_EVENT ||--o{ TRAINING_DETAIL : includes
  TRAINING_EVENT ||--o{ ATTENDANCE_VOTE : has
  USER          ||--o{ ATTENDANCE_VOTE : votes

  CLASS ||--o{ TRAINING_TEMPLATE_ITEM : has
  USER  ||--o{ TRAINING_PROGRESS : tracks
  CLASS ||--o{ TRAINING_PROGRESS : scopes
  TRAINING_EVENT ||--o{ TRAINING_PROGRESS : progressFor
  TRAINING_TEMPLATE_ITEM ||--o{ TRAINING_PROGRESS : progressFor

  USER ||--o{ ACTIVITY_RECORD : logs
  ACTIVITY_RECORD ||--o{ COACH_FEEDBACK : gets
  USER ||--o{ COACH_FEEDBACK : writes

  CLASS ||--o{ POST : has
  USER  ||--o{ POST : writes
  POST  ||--o{ COMMENT : has
  USER  ||--o{ COMMENT : writes

  CLASS ||--o{ MEDIA_ASSET : has
  TRAINING_EVENT ||--o{ MEDIA_ASSET : attaches
  USER ||--o{ MEDIA_ASSET : uploads

  PLAN ||--o{ SUBSCRIPTION : usedBy
  USER ||--o{ SUBSCRIPTION : owns
  CLASS ||--o{ SUBSCRIPTION : forClass

  PLAN ||--o{ PAYMENT : billedIn
  USER ||--o{ PAYMENT : pays
  SUBSCRIPTION ||--o{ PAYMENT : payments

  USER ||--o{ ENTITLEMENT : has

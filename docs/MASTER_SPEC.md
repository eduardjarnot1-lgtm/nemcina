You are the lead autonomous software engineer responsible for building a production-ready mobile language-learning application.

You are working inside an existing development environment connected to Git/GitHub and you may also collaborate with another AI coding/reasoning agent such as ChatGPT/Codex when useful.

Your task is NOT to create a quick prototype and stop.

Your task is to progressively design, build, test, improve, document, and prepare the application for real users.

Work autonomously whenever possible.

Do not constantly ask the user what to do next when the answer can reasonably be determined from this specification, the repository, existing files, previous implementation, good software-engineering practice, or discussion with the connected AI agent.

The application should eventually be suitable for release on both Android and iOS.

# 1. PRODUCT VISION

Build a modern language-learning application focused initially on learning German.

The UI language should initially be English.

German is the first target language, but the architecture must be designed from the beginning so that additional languages can later be added without rebuilding the entire application.

Potential future languages include Spanish, French, Italian and others.

The application should combine:

- structured vocabulary learning
- grammar learning
- spaced repetition
- adaptive revision
- progress tracking
- gamification
- personalized learning plans
- AI-powered explanations
- AI tutoring / Learning Coach
- exercises
- levels and progression
- user accounts
- cloud synchronization
- free and premium versions

The app should feel somewhere between:

Duolingo
+
Anki
+
Quizlet
+
a personal AI language tutor

but it should have its own visual identity and learning system.

The purpose is not to clone Duolingo.

The app should feel polished, modern, intelligent, friendly and motivating.

# 2. FIRST TARGET: GERMAN

The first complete language is German.

The application should eventually support levels:

A1
A2
B1
B2
C1
C2

according to the CEFR system.

However, do NOT pretend that levels have complete content if they do not.

Only display content as complete when actual learning material exists for it.

The first major content focus is B1 German vocabulary.

There is also C1 grammar material available in the project files.

# 3. SOURCE MATERIALS

Inspect all relevant files provided in the project before implementing the learning database.

Two important source documents have already been supplied:

1. Goethe / ÖSD B1 vocabulary list.
2. German C1 grammar learning material.

Treat these files as source material, not simply as PDFs to display inside the app.

Create an import pipeline that turns them into structured learning data.

The pipeline should conceptually work like:

PDF/source file
→ extraction
→ parsing
→ normalization
→ validation
→ structured JSON/data
→ database import
→ learning exercises
→ progress system

The import process should be reproducible.

Do NOT manually hard-code thousands of vocabulary items into UI code.

# 4. B1 VOCABULARY DATABASE

The Goethe B1 vocabulary list contains approximately 2,400 lexical units.

Extract and organize the useful learning information.

Where available, store data such as:

German word

English translation

word type

noun article

noun gender

plural

verb forms

important conjugations

separable prefix information

reflexive information

prepositions associated with the word

example sentence

related words

synonyms where explicitly supported

category

subcategory

CEFR level

source

source location/page

regional German variant

The source distinguishes German variants including:

D = Germany
A = Austria
CH = Switzerland

Preserve these distinctions.

Do not incorrectly replace Austrian or Swiss standard vocabulary with German-only equivalents.

The structured data model should be flexible enough to support language-specific attributes for future languages.

# 5. VOCABULARY ORGANIZATION

Vocabulary should not appear as one massive list.

Organize words into meaningful learning groups.

Examples:

Daily life
Family
People
House
Food
School
Work
Travel
Transport
Health
Shopping
Nature
Communication
Time
Society
Technology
Public services
Adjectives
Verbs
Nouns
Adverbs
Useful expressions

Where better categories can be inferred from the source material, use them.

Vocabulary should also be divided into manageable lesson units.

For example:

Category
→ Subcategory
→ Lesson
→ approximately 10–20 learning items

Do not create lessons so large that they feel overwhelming.

# 6. VOCABULARY LEARNING EXPERIENCE

Each vocabulary item should have a clean learning card.

Depending on the word type it may show:

German word

article

plural

English meaning

example

pronunciation controls

important grammar information

progress state

Users should be able to mark whether they already know a word.

Possible learning states:

New
Learning
Review
Strong
Mastered

Do not rely solely on manual states.

The app should automatically adjust mastery based on actual performance.

# 7. EXERCISE SYSTEM

Create multiple exercise types.

Examples:

German → English

English → German

multiple choice

article selection

gender selection

plural selection

sentence completion

fill in the blank

word matching

sentence reconstruction

correct word in context

verb conjugation

separable verb exercises

recognition exercises

typing exercises

listening exercises when audio becomes available

translation exercises

contextual usage

true / false

The learning system should avoid repeatedly presenting exactly the same format.

Exercises should gradually become harder as mastery increases.

For example:

Stage 1:
Recognition

Stage 2:
Multiple choice

Stage 3:
Recall

Stage 4:
Typing

Stage 5:
Usage in sentence/context

# 8. SPACED REPETITION

Implement a real spaced-repetition / adaptive-review system.

Track for every user and every learning item:

attempt count

correct answers

incorrect answers

success rate

last reviewed

next review

current mastery

difficulty

response history

recent mistakes

streak where useful

The learning system should prioritize:

1. overdue reviews
2. weak vocabulary
3. recently failed items
4. currently learning items
5. new items
6. occasional mastered-item reinforcement

Do not show new words endlessly while neglected words remain weak.

# 9. PERSONALIZED LEARNING

The app should become increasingly personalized as it learns about the user.

Store relevant learning information in the database.

Examples:

known words

weak words

strong words

grammar weaknesses

frequent mistakes

exercise results

lesson completion

time spent

streaks

learning pace

AI coach interactions where appropriate

daily activity

The app should use this data to create personalized recommendations.

Examples:

"You struggle with noun genders."

"Review these 12 verbs."

"You frequently confuse dative and accusative."

"These 8 words are due for review."

"Your strongest category is Travel."

# 10. LEARNING COACH AI

A major feature should be an AI Learning Coach.

Design the system so the AI coach can access relevant structured user learning data through safe backend tools/functions.

The AI should NOT receive unrestricted database access.

Create controlled functions such as conceptually:

getUserProgress()

getWeakVocabulary()

getRecentMistakes()

getGrammarWeaknesses()

getDueReviews()

getLessonHistory()

getVocabularyItem()

getGrammarTopic()

The AI Learning Coach should be able to:

explain mistakes

explain grammar

give examples

answer German-language questions

recommend what to learn next

generate short personalized exercises

explain vocabulary differences

help with sentence construction

explain why an answer was wrong

encourage the learner

create a small personalized study plan

Use an appropriate OpenAI model/API architecture.

Store API keys securely using environment variables / backend secrets.

NEVER expose API keys in:

frontend source code

Git

GitHub repository

mobile application bundles

public configuration files

# 11. AI COST CONTROL

AI features must be designed with cost control from the beginning.

The normal vocabulary-learning application should NOT require an AI API call for every interaction.

Most exercises should use deterministic application logic and stored learning data.

AI should be reserved for higher-value tasks such as:

personalized explanations

coach conversations

generated contextual examples

advanced feedback

study plans

complex grammar help

Implement usage tracking and reasonable limits.

# 12. FREE VERSION

The free application should still be genuinely useful.

Possible free features:

core vocabulary learning

normal exercises

progress tracking

limited spaced repetition

daily learning

basic statistics

limited AI Learning Coach usage

advertising

A reasonable initial AI limit could be approximately five higher-quality AI interactions within an appropriate reset period.

Design this limit so it can later be changed remotely/configurably rather than being permanently hard-coded.

# 13. PREMIUM VERSION

Premium should provide significant extra value.

Potential Premium features:

much higher AI usage limits

advanced personalized learning plans

more detailed statistics

additional learning modes

advanced grammar explanations

fewer or no advertisements

additional AI practice

faster progression tools

offline functionality where practical

Do NOT implement genuinely unlimited AI usage without safeguards.

Use generous but controlled limits or a fair-use system.

The exact pricing model can be configured later.

# 14. ADVERTISING

Prepare architecture for advertising, likely through a mobile ad provider such as AdMob.

Potential free-tier advertising formats:

small banner in appropriate parts of the UI

occasional interstitial ads

rewarded ads

Rewarded ads could provide things such as:

extra lesson credits

additional AI Coach question

double lesson reward

temporary bonus

Ads should never make the learning experience unusable.

Do not place intrusive advertisements after every small action.

Keep ad configuration modular so frequency can easily be adjusted.

# 15. GAMIFICATION

Create motivating but not childish gamification.

Potential systems:

XP

daily goals

streaks

lesson completion

levels

progress bars

achievements

category mastery

weekly progress

daily challenge

reward currency if useful

The purpose is to encourage consistent learning rather than create meaningless numbers.

# 16. MASTER FUKA / GUIDE CHARACTER

The application has a guide / mascot character called:

Master Fuka

Master Fuka should act as a recognizable guide throughout the learning experience.

He can:

welcome users

explain features

celebrate progress

introduce lessons

give short tips

present occasional feedback

The character should add personality without constantly interrupting learning.

Design the UI so a character image/animation can easily be added or changed later.

# 17. C1 GRAMMAR

The supplied C1 grammar material should become structured grammar learning content.

Do not simply show the source PDF.

Analyze its structure and create grammar topics.

Examples present in the material include topics such as:

subjective meanings of modal verbs

word formation

prefixes

two-part connectors

noun-verb combinations

modal verb alternatives

unreal consequence clauses

adjective endings

functions of "es"

adjective gradation

reported speech

indirect questions

indirect commands

dative prepositions

nominal and verbal style

causal structures

and additional topics found in the document.

For every grammar topic, where supported by the source, store:

title

CEFR level

explanation

rules

important distinctions

examples

subtopics

prerequisites

exercise templates

source

source location

Create exercises such as:

fill in the blank

multiple choice

sentence transformation

error correction

sentence reconstruction

correct grammar selection

context exercises

short production exercises

The app should clearly distinguish source-derived examples from AI-generated examples.

Never falsely imply that generated material came directly from the textbook.

# 18. USER ACCOUNTS

Prepare production-grade authentication.

Support architecture for:

Google Sign-In

Sign in with Apple

email/password

possibly anonymous/guest onboarding if useful

User learning progress must be associated with the authenticated account.

A user should eventually be able to switch devices and retain progress.

# 19. DATABASE

Use a scalable backend/database solution suitable for a mobile startup.

Choose a sensible technology based on the existing stack.

Examples could include:

Supabase/PostgreSQL

Firebase

or another appropriate backend.

Prefer a relational structure when it significantly improves learning-data integrity.

Possible core entities include:

users

languages

courses

cefr_levels

categories

lessons

vocabulary_items

grammar_topics

exercise_templates

user_vocabulary_progress

user_grammar_progress

lesson_attempts

exercise_attempts

review_schedule

user_statistics

user_preferences

ai_usage

subscriptions

achievements

Design proper indexes and relationships.

Do not store all progress as one enormous JSON blob.

# 20. MULTI-LANGUAGE ARCHITECTURE

Although German comes first, do not tightly couple the codebase to German.

Architecture should support:

source language

target language

course

CEFR level

localized UI strings

language-specific vocabulary metadata

language-specific grammar metadata

Later we should be able to add:

English → Spanish

English → French

etc.

without rebuilding the entire application.

# 21. ONBOARDING

Create polished onboarding.

A possible onboarding journey:

Welcome

→ choose target language

→ choose approximate level

→ choose daily goal

→ optionally take placement test

→ create/login account

→ personalized home screen

The placement test can initially be simple but the architecture should support improvement later.

# 22. HOME SCREEN

The main screen should immediately tell the learner what to do.

Potential structure:

Daily goal

Continue learning

Review due words

Recommended lesson

Progress

Streak

AI Coach access

The application should avoid overwhelming the learner with dozens of buttons.

# 23. COURSE MAP

Create a visually engaging course/learning path.

The user should see progress through the language.

For example:

A1
↓
A2
↓
B1
↓
B2
↓
C1
↓
C2

Within a level:

topic
→ lessons
→ checkpoints
→ review

Do not copy Duolingo's interface directly.

Create an original but intuitive version.

# 24. SEARCH / DICTIONARY

Include searchable vocabulary.

The user should eventually be able to search by:

German word

English meaning

category

word type

possibly grammar topic

Search results should show useful vocabulary information and the user's mastery level.

# 25. STATISTICS

Provide useful statistics.

Possible stats:

words learned

words mastered

reviews due

weekly activity

accuracy

learning time

strongest categories

weakest categories

grammar progress

streak

CEFR progress estimates

Do not present fake precision.

For example, do not claim:

"You are exactly 73.82% B1"

unless the methodology genuinely supports that number.

# 26. DESIGN DIRECTION

The application should look like a modern commercial mobile product.

Characteristics:

clean

friendly

premium

minimal but not sterile

smooth

clear hierarchy

rounded modern UI components

high readability

subtle animations

satisfying interaction feedback

excellent spacing

professional icons

consistent design system

Avoid:

cheap template appearance

overcrowded dashboards

random gradients everywhere

inconsistent component styles

tiny text

desktop-looking screens squeezed into mobile

The interface should feel native and comfortable on mobile devices.

Support both common Android and iOS screen sizes.

Build reusable components rather than separate one-off visual styles.

# 27. UX PRINCIPLES

Learning should require minimal navigation.

Common actions should normally take no more than a few taps.

Always make it obvious:

where the learner is

what they are learning

what they should do next

how much progress they made

what was correct

what was incorrect

why an answer was wrong when appropriate

Animations should improve clarity rather than slow the user down.

# 28. ACCESSIBILITY

Use:

sufficient contrast

reasonable font sizes

large enough touch targets

screen-reader-friendly labels

dynamic layouts

clear feedback not based solely on color

Prepare architecture for accessibility from the beginning.

# 29. AUDIO ARCHITECTURE

Prepare vocabulary components to support German pronunciation.

Do not unnecessarily generate expensive audio for every interaction.

Design an abstraction so we can later use:

stored pronunciation audio

text-to-speech

or another provider.

# 30. OFFLINE / PERFORMANCE

The app should start quickly.

Avoid unnecessary network calls.

Cache frequently used learning content.

Where sensible, vocabulary lessons should remain usable with poor connectivity.

User progress should synchronize safely after connectivity returns if offline functionality is implemented.

# 31. SECURITY

Treat security as a core requirement.

Follow best practices.

Do not expose secrets.

Use backend authorization.

Users must not be able to modify another user's progress.

Use appropriate row-level security / authorization rules.

Validate server-side inputs.

Do not trust the mobile client for:

subscription status

AI limits

premium status

sensitive progress manipulation

or billing validation.

# 32. PRIVACY

Store only data useful for operating and improving the learning experience.

Prepare for privacy requirements such as GDPR.

Users should eventually be able to:

request account deletion

delete account/data

understand what is collected

review privacy information

Avoid storing unnecessary personal data.

# 33. SUBSCRIPTIONS

Prepare architecture for mobile subscriptions.

Eventually support:

Apple App Store subscriptions

Google Play subscriptions

Premium entitlement should be validated safely.

Do not trust a simple client-side boolean such as:

premium = true

Design subscription access behind an entitlement/service layer.

# 34. ANALYTICS

Create an analytics abstraction.

Track useful anonymous/product events such as:

onboarding_completed

lesson_started

lesson_completed

exercise_answered

review_completed

ai_coach_used

subscription_screen_viewed

subscription_started

rewarded_ad_completed

Do not scatter provider-specific analytics calls throughout the whole codebase.

Use a centralized analytics service.

# 35. ERROR HANDLING

The application should fail gracefully.

Examples:

AI unavailable

network unavailable

database timeout

ad unavailable

authentication error

subscription validation failure

The learning experience should not completely collapse because a third-party API failed.

# 36. TESTING

Testing is mandatory.

Create appropriate:

unit tests

integration tests

database tests

UI/component tests where useful

end-to-end tests for critical user journeys

Important flows to test:

registration/login

onboarding

vocabulary import

starting lesson

answering exercises

wrong/right answers

progress persistence

spaced repetition

review scheduling

grammar lessons

AI Coach access

AI usage limits

premium checks

search

logout/login persistence

new user state

existing user state

# 37. CONTENT VALIDATION

Create validation scripts for imported language content.

Detect issues such as:

missing German word

duplicate IDs

duplicate vocabulary

missing translations

invalid CEFR level

invalid article

invalid regional label

missing lesson mapping

broken relationships

malformed grammar content

Do not silently import obviously corrupted content.

Produce validation reports.

# 38. COPYRIGHT / SOURCE HANDLING

Do not blindly redistribute source PDFs as part of the application.

Use structured source material only in ways consistent with its applicable licensing/copyright requirements.

Track source attribution internally.

Where the licensing status is uncertain, structure the system so problematic content can easily be replaced without changing the application architecture.

Do not falsely label AI-generated sentences as source material.

# 39. GIT WORKFLOW

Use Git properly.

Before major changes:

inspect repository state

understand current architecture

avoid destroying functioning code

Make logical commits with descriptive messages.

Examples:

feat: implement vocabulary data model

feat: add spaced repetition engine

feat: create onboarding flow

fix: persist lesson progress correctly

test: add review scheduling tests

Do not put dozens of unrelated features into one meaningless commit.

Never commit secrets.

Keep the repository buildable whenever reasonably possible.

# 40. COLLABORATION WITH CHATGPT / CODEX

You may use the connected ChatGPT/Codex agent as a second senior engineer.

Use it particularly for:

architecture review

complex debugging

security review

database design

testing strategy

algorithm review

UI/UX critique

performance issues

AI integration architecture

code review

Before finalizing major architectural decisions, ask the second agent to critically review the approach when practical.

Do not blindly accept its suggestions.

Evaluate them against the repository and product requirements.

You are both working toward the same product.

Avoid repeatedly debating minor style choices.

The goal is implementation.

# 41. DEVELOPMENT PROCESS

Start by thoroughly inspecting:

the repository

existing source code

configuration

dependencies

assets

provided learning-material files

existing database/schema

existing authentication

existing UI

Git status

Do not immediately rewrite the whole project.

Then create an internal implementation plan.

Break the project into logical phases.

A reasonable example:

Phase 1
Project stabilization + architecture

Phase 2
Design system + navigation

Phase 3
Learning content database

Phase 4
B1 vocabulary importer

Phase 5
Core vocabulary learning

Phase 6
Progress + spaced repetition

Phase 7
Authentication + cloud sync

Phase 8
Personalized learning

Phase 9
Grammar system

Phase 10
AI Learning Coach

Phase 11
Gamification

Phase 12
Premium / ads architecture

Phase 13
Statistics + polish

Phase 14
Testing + security

Phase 15
Mobile release preparation

Modify the order when repository reality makes another sequence more sensible.

# 42. AUTONOMOUS WORK RULE

After understanding the project, actively continue implementing the next logical task.

Do not stop after:

creating a plan

creating mockups

building only navigation

creating database tables

or implementing one lesson.

Continue through the roadmap.

When one task is finished:

test it

review it

commit it

move to the next logical task.

Only ask the user when you encounter something that genuinely requires their decision or credentials.

Examples that MAY require the user:

API key

Apple Developer account information

Google Play account information

billing credentials

AdMob identifiers

subscription product IDs

legally required business information

choice between two genuinely different product directions

For missing secrets, create safe placeholders/configuration and continue implementing everything that does not require the real secret.

Example:

OPENAI_API_KEY=<configured securely later>

Do not block all development just because the real key is unavailable.

# 43. DO NOT FAKE COMPLETION

Never claim a feature is complete simply because:

a UI button exists

a mock screen exists

a TODO exists

a hard-coded demo works

A feature is complete when its core real workflow functions and has been reasonably tested.

Example:

"Google login" is NOT complete if the button only displays an alert.

"AI Coach" is NOT complete if responses are hard-coded.

"Progress tracking" is NOT complete if data disappears after restarting the app.

# 44. TECHNICAL QUALITY

Prefer:

clear architecture

typed code

reusable components

services/repositories

clean interfaces

separation of concerns

testability

maintainability

simple solutions

Avoid unnecessary overengineering.

Do not introduce large frameworks only because they look sophisticated.

Every dependency should solve a real problem.

# 45. DOCUMENTATION

Maintain useful project documentation.

At minimum maintain/update:

README

setup instructions

environment variables

architecture overview

database setup

content-import instructions

testing instructions

mobile build instructions

known limitations

Do not let documentation become completely disconnected from the current implementation.

# 46. DEVELOPMENT LOG

Maintain a concise project status document such as:

PROJECT_STATUS.md

Track:

completed features

features in progress

next priorities

known bugs

important architectural decisions

external credentials still required

release blockers

This should allow another engineer or AI agent to understand the project quickly.

# 47. DEFINITION OF SUCCESS FOR THE FIRST MAJOR VERSION

The first serious version should allow a new user to:

install/open the application

create an account

select German

select their level

complete onboarding

see a personalized home screen

start a vocabulary lesson

learn real B1 vocabulary imported from the supplied source

complete multiple exercise types

receive immediate feedback

have results saved

close the application

open it again

retain progress

receive scheduled reviews

see vocabulary mastery

search vocabulary

see statistics

access grammar content

ask the AI Learning Coach for help

have the AI understand at least basic information about their learning weaknesses

use the application comfortably on mobile

The system should also be architecturally prepared for:

additional languages

premium subscriptions

advertisements

more grammar content

more AI features

Android release

iOS release

# 48. FIRST ACTION

Begin now.

First inspect the complete repository and all supplied source files.

Determine what already exists and what does not.

Do not throw away working functionality unnecessarily.

Create/update PROJECT_STATUS.md with the actual current state.

Create a practical development roadmap based on the repository.

Ask the connected ChatGPT/Codex agent for a high-level architecture/codebase review if available.

Then immediately begin implementing the highest-priority foundational work.

Continue autonomously through the roadmap.

After every meaningful development block:

1. run relevant tests
2. fix discovered errors
3. review the implementation
4. make an appropriate Git commit
5. update PROJECT_STATUS.md
6. determine the next highest-value task
7. continue

Do not stop merely to tell the user that one small step is complete.

Your objective is to progressively turn this repository into a polished, commercially viable German-learning application.
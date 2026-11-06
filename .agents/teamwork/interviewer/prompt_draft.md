Review and audit the Vedic astrology reading techniques for General Reading, Self, Work, and Love against Radha celestial tabular data, establishing an architectural evaluation document and phased implementation for deterministic audit logging, Admin review/enablement workflow, clarification questioning, and benchmark verification using seeded celebrity birth charts. Start by producing an architectural and evaluation document, obtaining user permission before applying production code and database updates.

Working directory: c:\Users\Owner\Documents\work\AIAstra_Server
Integrity mode: development

## Requirements

### R1. Architectural and Evaluation Plan (Phase 1)
Deliver a comprehensive architectural and evaluation document in the repository under `docs/` reviewing existing techniques for General Reading, Self, Work, and Love. The document must define:
- Gap analysis of current techniques against the 10,000 rows of Radha Lambda celestial tabular data.
- Hierarchical technique composition (how minor techniques, such as short sub-dashas or micro-activations, inform higher-level reading techniques across timeframes).
- Specification for deterministic querying and conclusion logging (audit trail linking every reading outcome to exact table rows and rules without hallucinations).
- Design of the clarification question mechanism for ambiguous chart placements.
- Admin Module review and enablement workflow design.
The team must present this plan and obtain explicit user permission before beginning production code and database updates.

### R2. Deterministic Audit Logging and Querying (Phase 2)
Implement querying logic over Radha Lambda's tabular celestial output to evaluate phases and life scenarios (e.g. leisure/resort vacation vs medical/hospital urgency) across life areas.
- Every reading determination must be derived exclusively from Radha-provided celestial data with zero hallucinations.
- Log the complete audit trail (input data rows, rules evaluated, and logical derivation) for each conclusion to support post-run verification, error analysis, and calibration.

### R3. Admin Module Review and Enablement Flow (Phase 2)
Implement the Admin process flow for technique management:
- Enable administrators to inspect individual technique definitions, their algorithms, data dependencies, and verification status.
- Provide an admin mechanism (API and UI controls) to toggle techniques as "enabled" or "disabled" for live user dashboards.
- Ensure user-facing dashboards execute only verified, enabled techniques.

### R4. Clarification Questioning Mechanism (Phase 3)
Build questioning logic into reading techniques:
- When celestial indicators yield ambiguity or multiple valid interpretations, generate targeted clarification questions to narrow the scope with the user rather than producing speculative readings.

### R5. Verified Celebrity Benchmark Dataset and Testing (Phase 3)
Seed an in-repo benchmark dataset of verified birth chart details for well-documented figures/celebrities.
- Utilize existing recorded Radha fixtures for test runs, and request/pull fresh celestial data from Radha Lambda if required by the catalogue.
- Run automated tests comparing technique evaluations against known life milestones across Work, Love, and Self.

### R6. Search Intent Analysis and Area Expansion (Phase 3)
Analyze common search queries and life-stage themes across life areas to identify candidate sub-categories. For each candidate area, define the required reading technique, the necessary Radha celestial data points, and the clarification questions.

### R7. External Dependencies and Code Integration Constraint
The team must inform and obtain confirmation from the user before importing any external open-source code, new libraries/frameworks, external scripts, or test fixtures from outside the repository.

## Acceptance Criteria

### Architectural and Evaluation Deliverable
- [ ] An architectural and evaluation document is committed under `docs/` detailing the technique audit, hierarchy of minor and macro techniques, audit log schema, and Admin enablement workflow.
- [ ] User review and permission are requested and confirmed prior to executing database schema changes or production writes.

### Deterministic Audit Logging
- [ ] Reading execution produces structured audit logs recording the exact Radha data points and rule evaluations that led to each conclusion.
- [ ] Zero hallucinations: no reading claim is generated without a traceable backing record in the audit log.

### Admin Review and Enablement
- [ ] Admin Module provides an interface and backend API to review technique contracts, algorithms, and verification records.
- [ ] Admin users can toggle individual techniques between enabled and disabled status, with live dashboards strictly filtering out disabled techniques.

### Clarification Workflow
- [ ] Ambiguous configurations produce structured clarification questions that narrow the reading scope before final output generation.

### Benchmark Verification
- [ ] In-repo seed dataset of verified birth charts is created.
- [ ] Test suite executes reading techniques against the seed charts using recorded fixtures (or verified Radha pulls) and outputs verification/audit logs.

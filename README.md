# PCM Migrator — Salesforce Digital Insurance Product Catalog Migrator

A web app for migrating Salesforce Revenue Cloud product catalog data from one org to another. Supports products, pricing, catalogs, classifications, and attributes with dependency-aware ordering, duplicate detection, and update-in-place for existing records.

---

## Features

- **OAuth 2.0 client_credentials** authentication — no username/password required
- **Dependency-aware migration** — objects are migrated in topological order based on their relationships
- **Duplicate detection** — skips records that already exist in the target org (composite key matching)
- **Update support** — optionally patches existing records instead of skipping (e.g. Product2, ProductClassificationAttr)
- **Lookup resolution** — source record IDs are remapped to target IDs across all object relationships
- **Real-time progress** — per-object Created / Skipped / Failed counts with a live log panel

---

## Supported Objects

| Group | Objects |
|-------|---------|
| Core | Product2, ProductSellingModel, ProductSellingModelOption |
| Catalog | ProductCatalog, ProductCategory, ProductCategoryProduct |
| Pricing | Pricebook2, PricebookEntry |
| Classifications | ProductClassification, ProductClassificationAttr |
| Attributes | AttributeDefinition, AttributePicklist, AttributePicklistValue, AttrPicklistExcludedValue, AttributeCategory, AttributeCategoryAttribute, ProductAttributeDefinition |

---

## Prerequisites

- Node.js 20+
- Two Salesforce orgs with Revenue Cloud enabled
- Connected App in each org configured for OAuth 2.0 `client_credentials` flow

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/rmojumdar/PCM_Migrator.git
cd PCM_Migrator
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example server/.env
```

Edit `server/.env` with your values:

```env
SESSION_SECRET=change_this_to_a_long_random_string_at_least_32_chars
PORT=3001
CLIENT_URL=http://localhost:5173
SF_API_VERSION=59.0

# Source org
SOURCE_INSTANCE_URL=https://yourorg.my.salesforce.com
SOURCE_CLIENT_ID=your_source_client_id
SOURCE_CLIENT_SECRET=your_source_client_secret

# Target org
TARGET_INSTANCE_URL=https://yoursandbox.my.salesforce.com
TARGET_CLIENT_ID=your_target_client_id
TARGET_CLIENT_SECRET=your_target_client_secret
```

### 4. Run in development mode

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001

---

## Usage

1. **Connect Orgs** — Enter Instance URL, Client ID, and Client Secret for both source and target orgs
2. **Select Objects** — Choose which object groups to migrate; required dependencies are auto-included
3. **Run Migration** — Monitor progress in real time; review the log for any errors or skips

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Auth | Salesforce OAuth 2.0 client_credentials |
| API | Salesforce REST API (SOQL + SObject endpoints) |

---

## Project Structure

```
PCM_Migrator/
├── client/                  # React frontend
│   └── src/
│       ├── pages/           # ConnectOrgs, SelectObjects, RunMigration
│       ├── components/      # Layout, OrgConnectForm
│       └── api/             # Axios client
├── server/                  # Express backend
│   └── src/
│       ├── controllers/     # auth, migration
│       ├── services/
│       │   ├── migration/   # executor, dag, object registry
│       │   └── salesforce/  # auth, query
│       └── types/           # Shared TypeScript interfaces
├── .env.example
└── package.json
```

# PRD: Local API / WebSocket Transformation Engine

## 1. Product Name

**Local API Transformation & Routing Engine**

A local backend server built with **Node.js + Express** that connects to input APIs or WebSocket streams, receives JSON data, transforms it based on user-defined configuration, and exposes the transformed data through custom output API endpoints.

All configuration, state, latest received data, transformation rules, endpoint definitions, and authentication settings will be stored **locally on the server as files**. No external database is required for the MVP.

---

## 2. Problem Statement

The user has devices or systems that send data through WebSockets or APIs. These systems return JSON data, but the raw JSON structure may not match the format required by another application, dashboard, mobile app, or client.

The user needs a local API middleware engine that can:

1. Connect to an existing WebSocket or REST API.
2. Receive JSON data from that source.
3. Modify, rename, filter, rearrange, or enrich the JSON.
4. Add custom values manually.
5. Expose the edited JSON through another API endpoint.
6. Keep the output updated whenever the original source data changes.
7. Store all configuration locally on the server.

---

## 3. Goal

Build a local Express-based server that works like this:

```text
Input API / WebSocket
        ↓
Local Transformation Engine
        ↓
Custom Output API
```

The user should be able to configure:

```text
Source URL → Transformation Rules → Output API URL
```

The output API should always return the latest transformed version of the source data.

---

## 4. MVP Scope

The MVP should include an Express backend, local-file storage, admin APIs, and a simple web UI that lets users configure sources, transformations, and output endpoints without directly calling APIs.

The MVP should support:

1. Add REST API source.
2. Add WebSocket source.
3. Store source configuration locally.
4. Store latest raw JSON locally.
5. Store transformed output locally.
6. Define JSON transformation rules.
7. Add static custom fields.
8. Create custom output API endpoint.
9. Edit source URL.
10. Edit output endpoint URL.
11. Add basic authentication for admin UI, admin APIs, and output APIs.
12. Store all configuration in local JSON files.
13. Provide a simple browser UI for configuration and monitoring.
14. Allow users to enter source details, transformation rules, static fields, and output endpoint paths from the UI.
15. Allow users to preview raw input JSON and transformed output JSON from the UI.

The MVP does not need:

1. Database.
2. Drag-and-drop mapper.
3. Complex visual workflow builder.
4. Multi-user access.
5. Advanced analytics.
6. Cloud deployment dependency.

---

## 5. Key Requirement: Local Storage Only

All application state must be stored locally on the server.

The system should not require PostgreSQL, MongoDB, Redis, DynamoDB, or any external database for the MVP.

Recommended local storage structure:

```text
project-root/
  public/
    index.html
    app.js
    styles.css
  data/
    sources.json
    transformations.json
    endpoints.json
    latest-raw/
      source_123.json
    latest-transformed/
      endpoint_789.json
    logs/
      app.log
      errors.log
  src/
    server.js
    routes/
    services/
    storage/
    ui/
```

### Local File Responsibilities

| File / Folder | Purpose |
|---|---|
| `sources.json` | Stores input API and WebSocket source configurations. |
| `transformations.json` | Stores JSON mapping and transformation rules. |
| `endpoints.json` | Stores custom output API definitions. |
| `latest-raw/` | Stores latest raw JSON received from each source. |
| `latest-transformed/` | Stores latest transformed JSON for each output endpoint. |
| `logs/` | Stores local application logs and errors. |

---

## 5.1 Simple Web UI Requirement

The system should include a simple local web UI served by the same Express server.

The UI should be available at:

```text
http://localhost:3000/admin
```

The UI should allow a user to configure the system without using Postman or manually editing JSON files.

### UI Pages / Screens

The MVP UI should include these screens:

1. **Login Screen**
   - User enters the admin key.
   - The key is stored in browser local storage or session storage for future admin API calls.
   - The UI should not expose the admin key in URLs.

2. **Dashboard**
   - Shows total sources, transformations, and output endpoints.
   - Shows source connection status.
   - Shows last received data time.
   - Shows recent local logs.

3. **Sources Page**
   - Add REST API source.
   - Add WebSocket source.
   - Edit source URL.
   - Add headers or auth config.
   - Enable or disable source.
   - Test connection.
   - View latest raw JSON.

4. **Transformation Page**
   - Select a source.
   - View sample/latest raw JSON.
   - Add mapping rows such as `temperature → current_temperature`.
   - Add static fields such as `location = Factory A`.
   - Add default values for missing fields.
   - Preview transformed JSON before saving.
   - Save transformation to local `data/transformations.json`.

5. **Output Endpoints Page**
   - Create custom output path.
   - Select source.
   - Select transformation.
   - Set whether output API requires an API key.
   - Edit output path later.
   - Copy final output API URL.
   - Preview live output JSON.

6. **Logs Page**
   - Show recent lines from `data/logs/app.log`.
   - Show recent errors from `data/logs/errors.log`.
   - Refresh logs manually.

### UI Design Requirements

The UI should be simple and functional. It does not need to be beautiful for MVP.

Recommended MVP approach:

```text
Express serves static HTML, CSS, and browser JavaScript from /public.
The browser JavaScript calls the local admin APIs using fetch().
No React, Vue, or Angular is required for MVP.
```

Suggested UI structure:

```text
public/
  index.html      # Main admin UI
  app.js          # Browser-side API calls and UI logic
  styles.css      # Basic styling
```

The UI should work fully from the local server and should not require any external frontend hosting.

---

## 6. Example Use Case

A device sends this JSON through a WebSocket:

```json
{
  "deviceId": "DVC-1001",
  "temperature": 31.5,
  "humidity": 65,
  "battery": 88,
  "status": "online",
  "timestamp": "2026-05-24T10:30:00Z"
}
```

The user only wants `temperature` and `status`, but also wants to add custom values.

The output API should return:

```json
{
  "machine_status": "online",
  "current_temperature": 31.5,
  "location": "Factory A",
  "unit": "celsius",
  "source": "AWS WebSocket"
}
```

When the original source sends a new temperature, the output API should automatically return the updated transformed value.

---

## 7. Functional Requirements

## FR-1: Add Input Source

The system must allow the user to add an input source.

Supported source types:

1. REST API
2. WebSocket

Each source should include:

```json
{
  "id": "source_123",
  "name": "Device Sensor Feed",
  "type": "websocket",
  "url": "wss://example.amazonaws.com/device-feed",
  "authType": "api_key",
  "authConfig": {
    "headerName": "x-api-key",
    "apiKey": "example-key"
  },
  "headers": {},
  "pollIntervalSeconds": null,
  "enabled": true,
  "createdAt": "2026-05-24T10:00:00Z",
  "updatedAt": "2026-05-24T10:00:00Z"
}
```

For REST APIs, `pollIntervalSeconds` should define how often the system fetches new data.

For WebSockets, the system should keep the connection open and listen for updates.

---

## FR-2: Edit Input Source

The system must allow the user to edit an existing source.

Editable fields:

1. Source name
2. Source URL
3. Authentication details
4. Headers
5. Polling interval
6. Enabled/disabled status

When a WebSocket source URL is changed, the system should disconnect from the old URL and reconnect to the new URL.

---

## FR-3: Connect to WebSocket Source

The system must connect to a configured WebSocket URL.

Behavior:

1. Connect to the WebSocket.
2. Listen for JSON messages.
3. Parse incoming messages.
4. Store the latest raw JSON in `data/latest-raw/{sourceId}.json`.
5. Apply transformation rules linked to that source.
6. Store latest transformed output in `data/latest-transformed/{endpointId}.json`.
7. Reconnect automatically if the WebSocket disconnects.

---

## FR-4: Fetch REST API Source

The system must fetch data from configured REST APIs.

Behavior:

1. Call the configured REST API URL.
2. Add configured headers or authentication.
3. Parse JSON response.
4. Store latest raw JSON locally.
5. Apply transformation rules.
6. Update linked output endpoint data.
7. Repeat based on polling interval.

---

## FR-5: Store Latest Raw Data Locally

For every source, the system must store the latest received raw JSON locally.

Example file:

```text
data/latest-raw/source_123.json
```

Example content:

```json
{
  "deviceId": "DVC-1001",
  "temperature": 31.5,
  "humidity": 65,
  "battery": 88,
  "status": "online"
}
```

---

## FR-6: Create Transformation Rule

The system must allow the user to define transformation rules for a source.

Transformation rules should support:

1. Select fields from source JSON.
2. Rename fields.
3. Change output path.
4. Add static custom fields.
5. Add default values.
6. Flatten nested JSON.
7. Create nested output JSON.
8. Remove fields by not mapping them.

Example transformation config:

```json
{
  "id": "transform_456",
  "name": "Device Output Format",
  "sourceId": "source_123",
  "mappings": [
    {
      "sourcePath": "temperature",
      "targetPath": "current_temperature",
      "defaultValue": null
    },
    {
      "sourcePath": "status",
      "targetPath": "machine_status",
      "defaultValue": "unknown"
    }
  ],
  "staticFields": [
    {
      "targetPath": "location",
      "value": "Factory A"
    },
    {
      "targetPath": "unit",
      "value": "celsius"
    }
  ],
  "enabled": true,
  "createdAt": "2026-05-24T10:00:00Z",
  "updatedAt": "2026-05-24T10:00:00Z"
}
```

---

## FR-7: Preview Transformation

The system must allow the user to preview a transformation before saving or publishing it.

Input:

1. Sample raw JSON.
2. Transformation rules.

Output:

1. Transformed JSON preview.
2. Errors if source paths are missing or invalid.

---

## FR-8: Create Output API Endpoint

The system must allow the user to create a custom output API endpoint.

Example:

```text
GET /api/output/device-status
```

Endpoint config:

```json
{
  "id": "endpoint_789",
  "name": "Device Status Output",
  "path": "/api/output/device-status",
  "method": "GET",
  "sourceId": "source_123",
  "transformationId": "transform_456",
  "authRequired": true,
  "apiKey": "output-api-key-example",
  "enabled": true,
  "createdAt": "2026-05-24T10:00:00Z",
  "updatedAt": "2026-05-24T10:00:00Z"
}
```

---

## FR-9: Edit Output API Endpoint

The system must allow the user to edit an existing output endpoint.

Editable fields:

1. Endpoint name
2. Endpoint path
3. Linked source
4. Linked transformation
5. Authentication requirement
6. Enabled/disabled status

When the endpoint path changes, the new path should serve the latest transformed data.

---

## FR-10: Serve Latest Transformed Data

When an external client calls the output endpoint, the system must return the latest transformed JSON.

Example request:

```http
GET /api/output/device-status
x-api-key: output-api-key-example
```

Example response:

```json
{
  "machine_status": "online",
  "current_temperature": 31.5,
  "location": "Factory A",
  "unit": "celsius"
}
```

The response should come from the latest local transformed state stored in:

```text
data/latest-transformed/endpoint_789.json
```

---

## FR-11: Real-Time Update Behavior

Whenever new source data arrives:

1. Save latest raw data locally.
2. Find transformations linked to that source.
3. Apply transformations.
4. Find endpoints linked to those transformations.
5. Save latest transformed output locally.
6. Output API should return the updated result on the next request.

Example source update:

```json
{
  "temperature": 32.1,
  "status": "online"
}
```

Updated output:

```json
{
  "current_temperature": 32.1,
  "machine_status": "online",
  "location": "Factory A",
  "unit": "celsius"
}
```

---

## FR-12: Authentication

The system should support basic authentication for both admin APIs and output APIs.

### Admin API Authentication

Admin routes should require an admin API key.

Example:

```http
x-admin-key: local-admin-secret
```

The admin key can be stored in a local `.env` file.

Example `.env`:

```text
PORT=3000
ADMIN_API_KEY=local-admin-secret
CONFIG_DIR=./data
```

### Output API Authentication

Each output endpoint can optionally require an API key.

Example:

```http
x-api-key: output-api-key-example
```

If `authRequired` is `false`, the endpoint can be public within the network.

---

## FR-13: Local Logs

The system must write logs locally.

Logs should include:

1. Source created.
2. Source updated.
3. WebSocket connected.
4. WebSocket disconnected.
5. WebSocket reconnect attempt.
6. REST API fetch success.
7. REST API fetch failure.
8. Transformation success.
9. Transformation error.
10. Output API request.
11. Authentication failure.

Log location:

```text
data/logs/app.log
```

Error log location:

```text
data/logs/errors.log
```

---

## FR-14: Simple Admin UI

The system must provide a simple web UI for configuration.

The UI must allow users to:

1. Log in using the admin key.
2. Create, view, edit, enable, disable, and delete sources.
3. View latest raw JSON for a source.
4. Create, view, edit, and delete transformations.
5. Add field mappings through form rows.
6. Add static custom fields through form rows.
7. Preview transformed output before saving.
8. Create, view, edit, enable, disable, and delete output endpoints.
9. Copy output API URLs.
10. View latest transformed JSON.
11. View basic logs.

The UI should call the existing admin APIs. The UI should not directly write to local files from the browser. All file updates must happen through the Express backend.

---

## 8. API Design

## 8.1 Admin APIs

All admin APIs require:

```http
x-admin-key: local-admin-secret
```

The simple admin UI should call these APIs from browser JavaScript using the same `x-admin-key` header after login.

### Serve Admin UI

```http
GET /admin
```

Returns the local admin UI HTML page.

Static UI assets:

```http
GET /public/app.js
GET /public/styles.css
```


### Create Source

```http
POST /admin/sources
```

Request:

```json
{
  "name": "Device WebSocket",
  "type": "websocket",
  "url": "wss://example.amazonaws.com/devices",
  "authType": "none",
  "authConfig": {},
  "headers": {},
  "enabled": true
}
```

---

### List Sources

```http
GET /admin/sources
```

---

### Get Source

```http
GET /admin/sources/:sourceId
```

---

### Update Source

```http
PUT /admin/sources/:sourceId
```

Request:

```json
{
  "url": "wss://new-example.amazonaws.com/devices",
  "enabled": true
}
```

---

### Delete Source

```http
DELETE /admin/sources/:sourceId
```

---

### Get Latest Raw Source Data

```http
GET /admin/sources/:sourceId/latest
```

---

### Create Transformation

```http
POST /admin/transformations
```

Request:

```json
{
  "name": "Device Transform",
  "sourceId": "source_123",
  "mappings": [
    {
      "sourcePath": "temperature",
      "targetPath": "current_temperature"
    },
    {
      "sourcePath": "status",
      "targetPath": "machine_status",
      "defaultValue": "unknown"
    }
  ],
  "staticFields": [
    {
      "targetPath": "location",
      "value": "Factory A"
    }
  ]
}
```

---

### List Transformations

```http
GET /admin/transformations
```

---

### Update Transformation

```http
PUT /admin/transformations/:transformationId
```

---

### Preview Transformation

```http
POST /admin/transformations/preview
```

Request:

```json
{
  "sampleData": {
    "temperature": 31.5,
    "status": "online"
  },
  "mappings": [
    {
      "sourcePath": "temperature",
      "targetPath": "current_temperature"
    }
  ],
  "staticFields": [
    {
      "targetPath": "unit",
      "value": "celsius"
    }
  ]
}
```

Response:

```json
{
  "current_temperature": 31.5,
  "unit": "celsius"
}
```

---

### Create Output Endpoint

```http
POST /admin/endpoints
```

Request:

```json
{
  "name": "Device Status Output",
  "path": "/api/output/device-status",
  "method": "GET",
  "sourceId": "source_123",
  "transformationId": "transform_456",
  "authRequired": true,
  "apiKey": "output-api-key-example",
  "enabled": true
}
```

---

### List Output Endpoints

```http
GET /admin/endpoints
```

---

### Update Output Endpoint

```http
PUT /admin/endpoints/:endpointId
```

---

### Delete Output Endpoint

```http
DELETE /admin/endpoints/:endpointId
```

---

## 8.2 Public / Output APIs

### Get Transformed Output

```http
GET /api/output/:customPath
```

Example:

```http
GET /api/output/device-status
x-api-key: output-api-key-example
```

Response:

```json
{
  "machine_status": "online",
  "current_temperature": 31.5,
  "location": "Factory A",
  "unit": "celsius"
}
```

---

## 9. Transformation Logic

The transformation engine should read values from the source JSON using dot notation.

Example source JSON:

```json
{
  "device": {
    "id": "DVC-1001",
    "metrics": {
      "temperature": 31.5
    }
  }
}
```

Example mapping:

```json
{
  "sourcePath": "device.metrics.temperature",
  "targetPath": "temperature.current"
}
```

Output:

```json
{
  "temperature": {
    "current": 31.5
  }
}
```

### Missing Source Field Behavior

If a source path is missing:

1. Use `defaultValue` if provided.
2. Otherwise set the target value to `null`.
3. Log a warning.

Example:

```json
{
  "sourcePath": "battery",
  "targetPath": "battery_percentage",
  "defaultValue": 0
}
```

---

## 10. Local File Storage Design

## 10.1 `sources.json`

```json
[
  {
    "id": "source_123",
    "name": "Device WebSocket",
    "type": "websocket",
    "url": "wss://example.amazonaws.com/devices",
    "authType": "none",
    "authConfig": {},
    "headers": {},
    "pollIntervalSeconds": null,
    "enabled": true,
    "createdAt": "2026-05-24T10:00:00Z",
    "updatedAt": "2026-05-24T10:00:00Z"
  }
]
```

## 10.2 `transformations.json`

```json
[
  {
    "id": "transform_456",
    "name": "Device Transform",
    "sourceId": "source_123",
    "mappings": [
      {
        "sourcePath": "temperature",
        "targetPath": "current_temperature",
        "defaultValue": null
      }
    ],
    "staticFields": [
      {
        "targetPath": "location",
        "value": "Factory A"
      }
    ],
    "enabled": true,
    "createdAt": "2026-05-24T10:00:00Z",
    "updatedAt": "2026-05-24T10:00:00Z"
  }
]
```

## 10.3 `endpoints.json`

```json
[
  {
    "id": "endpoint_789",
    "name": "Device Status Output",
    "path": "/api/output/device-status",
    "method": "GET",
    "sourceId": "source_123",
    "transformationId": "transform_456",
    "authRequired": true,
    "apiKey": "output-api-key-example",
    "enabled": true,
    "createdAt": "2026-05-24T10:00:00Z",
    "updatedAt": "2026-05-24T10:00:00Z"
  }
]
```

## 10.4 Latest Raw Data

```text
data/latest-raw/source_123.json
```

## 10.5 Latest Transformed Data

```text
data/latest-transformed/endpoint_789.json
```

---

## 11. Suggested Express Project Structure

```text
api-transform-engine/
  package.json
  .env
  public/
    index.html
    app.js
    styles.css
  data/
    sources.json
    transformations.json
    endpoints.json
    latest-raw/
    latest-transformed/
    logs/
  src/
    server.js
    app.js
    routes/
      adminSources.routes.js
      adminTransformations.routes.js
      adminEndpoints.routes.js
      output.routes.js
    middleware/
      adminAuth.js
      outputAuth.js
      errorHandler.js
    services/
      sourceManager.service.js
      websocket.service.js
      restPolling.service.js
      transformation.service.js
      endpoint.service.js
    storage/
      fileStore.js
    utils/
      jsonPath.js
      logger.js
```

---

## 12. Suggested Tech Stack

## Backend

```text
Node.js + Express.js
```

## WebSocket Client

```text
ws
```

## Local Storage

```text
JSON files using Node.js fs module
```

## Environment Config

```text
dotenv
```

## Authentication

```text
API key authentication using headers
```

## Optional Validation

```text
zod or joi
```

---

## 13. Required NPM Packages

```bash
npm install express ws dotenv uuid
```

Optional:

```bash
npm install zod morgan
```

---

## 14. Server Behavior on Startup

When the Express server starts:

1. Load `.env` file.
2. Ensure `data/` folder exists.
3. Ensure required JSON files exist:
   - `sources.json`
   - `transformations.json`
   - `endpoints.json`
4. Ensure latest data folders exist:
   - `latest-raw/`
   - `latest-transformed/`
5. Load all enabled sources.
6. Start WebSocket connections for enabled WebSocket sources.
7. Start polling jobs for enabled REST API sources.
8. Register output route handler.
9. Start Express server.

---

## 15. Authentication Rules

### Admin Routes

Admin routes must reject requests without the correct admin key.

Header:

```http
x-admin-key: local-admin-secret
```

Failure response:

```json
{
  "error": "Unauthorized admin request"
}
```

### Output Routes

If an endpoint has `authRequired: true`, the request must include the endpoint API key.

Header:

```http
x-api-key: output-api-key-example
```

Failure response:

```json
{
  "error": "Unauthorized API request"
}
```

---

## 16. Error Handling

The system should return clear errors.

### Invalid Source

```json
{
  "error": "Source not found"
}
```

### Invalid Transformation

```json
{
  "error": "Transformation not found"
}
```

### Invalid Endpoint

```json
{
  "error": "Endpoint not found"
}
```

### No Data Received Yet

```json
{
  "error": "No data received from source yet"
}
```

### Invalid JSON From Source

```json
{
  "error": "Source returned invalid JSON"
}
```

---

## 17. Non-Functional Requirements

## Performance

The output API should return data quickly because it reads from the latest locally stored transformed JSON.

Target response time for local output APIs:

```text
Under 300 ms
```

## Reliability

WebSocket connections should automatically reconnect if disconnected.

REST API polling should continue even if one request fails.

## Security

1. Admin APIs must be protected by an admin key.
2. Output APIs should optionally be protected by endpoint-level API keys.
3. Secrets should not be hardcoded in source code.
4. Admin API key should be stored in `.env`.
5. Local config files should not be exposed publicly.

## Portability

The full engine should be able to run on any server using:

```bash
npm install
npm start
```

## No External Database

The MVP must work without any external database.

All state must be stored in local files.

---

## 18. Acceptance Criteria

The MVP is complete when:

1. User can start the Express server locally.
2. Server creates required local data files and folders automatically.
3. User can create a WebSocket source through an admin API.
4. User can create a REST API source through an admin API.
5. WebSocket messages are received and stored locally.
6. REST API responses are fetched and stored locally.
7. User can define transformation rules.
8. User can add static custom fields.
9. User can create a custom output API path.
10. Output API returns transformed JSON.
11. Output API updates when source data changes.
12. User can edit source URL.
13. User can edit output API URL.
14. Admin APIs require authentication.
15. Output APIs can require authentication.
16. Configurations survive server restart because they are saved in local files.
17. User can open a local admin UI in the browser.
18. User can configure sources, transformations, and endpoints through the UI.
19. User can preview latest raw and transformed JSON through the UI.

---

## 19. Future Enhancements

After MVP, the system can support:

1. Advanced frontend dashboard with charts and widgets.
2. Drag-and-drop JSON mapper.
3. Version history for transformations.
4. Multiple users and roles.
5. Webhook output support.
6. MQTT input support.
7. Database storage option.
8. Export/import configuration.
9. Transformation scripting.
10. Rate limiting.
11. OpenAPI documentation generation.
12. Docker deployment.

---

## 20. Simple Summary

Build a local Express.js backend that lets the user configure:

```text
Input API/WebSocket → JSON transformation → Custom output API
```

All state and configuration must be stored locally on the server as files.

The system should receive live JSON data, apply saved transformation rules, add custom fields, and expose the latest transformed data through user-defined API endpoints with optional API key authentication.

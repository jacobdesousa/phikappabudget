## API (Express + Postgres)

### Config
This API reads configuration from environment variables.

See `env.example` for the full list.

### Run

```bash
npm install
npm run dev
```

### Endpoints
- `GET /healthz`
- `GET /brothers`
- `POST /brothers`
- `PUT /brothers/:id`
- `DELETE /brothers/:id`
- `GET /dues`
- `PUT /dues` (backwards-compatible: expects `id` in the body)
- `PUT /dues/:id` (more RESTful)
- `GET /revenue/category`
- `POST /revenue/category`
- `GET /revenue`
- `POST /revenue`

All endpoints are also available under the versioned prefix: `/api/v1/...`.




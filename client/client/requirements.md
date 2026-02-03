## Packages
framer-motion | For smooth page transitions and timeline animations
date-fns | For robust date formatting and manipulation

## Notes
- API uses POST /api/schedule for creating tasks
- API uses GET /api/status with query param ?task_id=UUID for status
- Since no global list endpoint exists, we use localStorage to persist Task IDs client-side
- Tailwind config needs to support 'font-display' and 'font-body'

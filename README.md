# ClientPulse - AI Client Success Agent

<div align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
</div>

## Overview

ClientPulse is an AI-first Client Success Management SaaS platform that helps companies provide intelligent customer support through an AI-powered chat widget. Companies can configure the AI agent with their knowledge base and routing rules, embed the chat widget on their product, and manage all customer interactions through a comprehensive dashboard.

## Features

- 🤖 **AI-Powered Chat**: Intelligent customer support with confidence scoring
- 🎫 **Ticket Management**: Automatic ticket creation and routing
- 📊 **Analytics Dashboard**: Comprehensive insights into customer interactions
- 🔐 **Role-Based Access**: Granular permissions for team members
- 📚 **Knowledge Base**: Centralized documentation management
- 🔄 **Real-time Updates**: Live conversation monitoring
- 📧 **Email Integration**: Automated notifications and routing
- 🎯 **Escalation Rules**: Configurable escalation workflows
- 📝 **Canned Responses**: Pre-built response templates
- 🔌 **Webhook Support**: Integration with external systems

## Architecture

ClientPulse is built as a monorepo with the following structure:

```
clientpulse/
├── apps/
│   ├── internal-dashboard/         # Next.js dashboard for CS teams
│   └── customer-chat/             # React widget for customer-facing chat
├── packages/
│   └── types/                      # Shared TypeScript types
├── backend/                        # Express.js API server
├── docs/
│   └── architecture/               # Detailed architecture documentation
└── README.md
```

For detailed architecture information, see [architecture.md](./architecture.md).

## Tech Stack

### Frontend
- **Internal Dashboard**: Next.js 14, Tailwind CSS, TypeScript
- **Customer Chat Widget**: React 18, Vite, Tailwind CSS, TypeScript

### Backend
- **API**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Supabase
- **Authentication**: JWT with bcrypt
- **AI Integration**: Groq (configurable to other providers)

### Development Tools
- **Package Manager**: npm
- **Type Checking**: TypeScript
- **Code Formatting**: Prettier (recommended)
- **Version Control**: Git

## Quick Start

### Prerequisites

- Node.js 20+ 
- PostgreSQL database (Supabase recommended)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/clientpulse.git
   cd clientpulse
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL=postgresql://...
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # AI Provider
   AI_PROVIDER=groq
   GROQ_API_KEY=your-groq-api-key
   
   # Authentication
   JWT_SECRET=your-jwt-secret
   
   # Server
   PORT=3001
   ```

4. **Set up the database**
   ```bash
   npm run db:setup
   ```

5. **Start the development servers**
   
   In separate terminals:
   ```bash
   # Backend server
   npm run dev
   
   # Internal dashboard
   cd apps/internal-dashboard
   npm run dev
   
   # Customer chat widget
   cd apps/customer-chat
   npm run dev
   ```

6. **Access the applications**
   - Internal Dashboard: http://localhost:3000
   - Customer Chat Widget: http://localhost:5173
   - Backend API: http://localhost:3001

## Development

### Scripts

- `npm run dev` - Start the backend server in development mode
- `npm run build` - Build all packages and applications
- `npm run test` - Run tests across all packages
- `npm run typecheck` - Type check all TypeScript code
- `npm run db:setup` - Run migrations and seed data
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with initial data

### Project Structure

#### Backend (`/backend`)
- **API Routes**: `/src/api/` - REST API endpoints
- **Services**: `/src/services/` - Business logic
- **Middleware**: `/src/middleware/` - Express middleware
- **Database**: `/src/db/` - Database configuration
- **Types**: `/src/types/` - Backend-specific types
- **Migrations**: `/db/migrations/` - Database schema changes

#### Internal Dashboard (`/apps/internal-dashboard`)
- **Pages**: `/app/` - Next.js app router pages
- **Components**: `/components/` - Reusable React components
- **Shared**: `/components/shared/` - Shared utilities and API clients

#### Customer Chat (`/apps/customer-chat`)
- **Pages**: `/src/pages/` - React pages
- **Components**: `/src/components/` - Reusable React components
- **API**: `/src/lib/api.ts` - API client
- **Styles**: `/src/styles.css` - Global styles

### Database

The project uses PostgreSQL with the following key tables:
- `companies` - Multi-tenant company information
- `users` - Agent and admin accounts
- `conversations` - Customer chat sessions
- `messages` - Individual chat messages
- `tickets` - Support tickets
- `company_documents` - Knowledge base articles
- `canned_responses` - Pre-built responses
- `escalation_rules` - Ticket escalation logic

See [architecture.md](./architecture.md) for the complete schema.

## Deployment

### Environment Variables

Production requires the following environment variables:

```env
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Provider
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key

# Authentication
JWT_SECRET=your-jwt-secret

# Server
PORT=3001
NODE_ENV=production
```

### Deployment Options

1. **Vercel** (Recommended for Next.js dashboard)
2. **Railway/Render** (For backend API)
3. **Supabase** (For database and authentication)
4. **Cloudflare Pages** (For customer chat widget)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Add comments for complex logic
- Update documentation as needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please contact support@clientpulse.io or open an issue on GitHub.

## Roadmap

- [ ] Advanced AI features (sentiment analysis, churn prediction)
- [ ] Mobile applications
- [ ] Advanced analytics and reporting
- [ ] Integration marketplace
- [ ] Multi-language support
- [ ] Custom AI model fine-tuning

---

<div align="center">
  Made with ❤️ by the ClientPulse team
</div>

# Contributing to Cultural Archiver

Thank you for considering contributing to Cultural Archiver!

We welcome contributions from the community to help document, preserve, and share cultural and public art. By contributing, you agree to abide by our Code of Conduct.

## 🚀 Quick Start

### Prerequisites

- **Node.js**: >=22.0.0 (for full compatibility)
- **npm**: Latest version 
- **Git**: For version control
- **Wrangler CLI**: For Cloudflare Workers development

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/cultural-archiver.git
   cd cultural-archiver
   ```

2. **Install Dependencies**
   ```bash
   npm run setup  # Installs deps and builds project
   ```

3. **Start Development**
   ```bash
   npm run dev    # Starts both frontend and backend in development mode
   ```

4. **Access the Application**
   - Frontend: http://localhost:5173
   - Workers API: http://localhost:8787

## 📁 Project Structure

```
cultural-archiver/
├── src/
│   ├── frontend/          # Vue 3 + TypeScript + Tailwind CSS
│   │   ├── src/
│   │   │   ├── components/    # Reusable Vue components
│   │   │   ├── views/         # Page-level components
│   │   │   ├── stores/        # Pinia state management
│   │   │   ├── services/      # API service layer
│   │   │   └── test/          # Test utilities and mocks
│   │   └── package.json
│   ├── workers/           # Cloudflare Workers + Hono API
│   │   ├── routes/            # API endpoint handlers
│   │   ├── middleware/        # Auth, rate limiting, validation
│   │   ├── lib/               # Database, photos, email utilities
│   │   ├── test/              # Backend test suites
│   │   └── package.json
│   └── shared/            # Shared TypeScript types and utilities
├── docs/                  # Project documentation
├── migrations/            # Database schema migrations
└── tasks/                 # Project management tasks
```

## 🛠 Development Workflow

### Making Changes

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow existing code patterns and conventions
   - Write TypeScript for all new code
   - Add tests for new functionality

3. **Run Quality Checks**
   ```bash
   # Type checking
   npm run type-check
   
   # Linting
   npm run lint
   
   # Testing
   npm run test
   
   # Formatting
   npm run format
   ```

4. **Test Your Changes**
   ```bash
   # Frontend tests
   cd src/frontend && npm run test
   
   # Backend tests  
   cd src/workers && npm run test
   
   # Build verification
   npm run build
   ```

5. **Commit and Push**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**
   - Provide clear description of changes
   - Reference any related issues
   - Ensure all CI checks pass

### Code Style Guidelines

#### TypeScript Standards
- Use strict TypeScript configuration
- Leverage type inference where possible
- Create interfaces for complex data structures
- Use discriminated unions for status/state management

#### Vue.js Components
- Use Composition API with `<script setup>`
- Follow single responsibility principle
- Implement proper accessibility (ARIA labels, keyboard navigation)
- Write comprehensive unit tests with Vue Test Utils + Vitest

#### Backend Development
- Follow RESTful API conventions
- Implement proper error handling with descriptive messages
- Use Zod for runtime validation
- Write integration tests for all endpoints

### Testing Patterns

#### Frontend Testing
```typescript
// Component testing example
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import YourComponent from '../YourComponent.vue'

describe('YourComponent', () => {
  it('renders correctly', () => {
    const wrapper = mount(YourComponent, {
      props: { /* your props */ }
    })
    expect(wrapper.text()).toContain('expected text')
  })
})
```

#### Backend Testing
```typescript
// API testing example
import { describe, it, expect, beforeEach } from 'vitest'
import { createMockEnv } from './test-utils'

describe('API Endpoint', () => {
  let env: MockEnv
  
  beforeEach(() => {
    env = createMockEnv()
  })
  
  it('handles request correctly', async () => {
    const response = await handleRequest(request, env)
    expect(response.status).toBe(200)
  })
})
```

## 📋 Pull Request Checklist

Before submitting your PR, ensure:

- [ ] **Tests**: All new code has corresponding unit/integration tests
- [ ] **Types**: TypeScript compilation passes without errors
- [ ] **Linting**: ESLint checks pass
- [ ] **Formatting**: Code is properly formatted with Prettier
- [ ] **Documentation**: Updated relevant documentation
- [ ] **Accessibility**: New UI components follow WCAG AA guidelines
- [ ] **Mobile**: Changes work across all supported screen sizes (320px-1920px)
- [ ] **Performance**: No unnecessary re-renders or API calls

## 🎯 Contribution Guidelines

### Bug Reports
- Use GitHub Issues with the "bug" label
- Include reproduction steps and environment details
- Provide screenshots for UI issues

### Feature Requests
- Use GitHub Issues with the "enhancement" label
- Describe the problem and proposed solution
- Consider implementation complexity and user impact

### Documentation Improvements
- Fix typos, clarify instructions, add examples
- Update API documentation for endpoint changes
- Improve code comments for complex logic

## 🔒 Security Guidelines

- Never commit secrets, API keys, or credentials
- Use environment variables for configuration
- Follow secure coding practices (input validation, sanitization)
- Report security vulnerabilities privately to maintainers

## 📝 Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(components): add PhotoCarousel with touch support
fix(api): handle artwork not found errors correctly
docs(readme): update development setup instructions
test(frontend): add tests for MapComponent navigation
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `style`, `chore`

## 🚦 Release Process

1. Version bumps follow [Semantic Versioning](https://semver.org/)
2. All changes are documented in CHANGELOG.md
3. Releases are created from the main branch
4. CI automatically deploys to staging and production

## 🤝 Community Guidelines

- Be respectful and inclusive
- Help newcomers get started
- Provide constructive feedback in code reviews
- Follow the project's architectural decisions
- Ask questions when unsure

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and community chat
- **Documentation**: Check `/docs` folder for detailed guides

### Licensing

- **Code**: Licensed under MIT License
- **Data/Metadata**: Licensed under CC0 (public domain)
- **Photos**: Contributors retain copyright, platform usage under CC0

By submitting a contribution, you agree to these licensing terms.

## 🙏 Recognition

Contributors are recognized in:
- Git commit history
- GitHub contributors page  
- Periodic contributor highlights in releases

Thank you for helping preserve cultural heritage! 🎨

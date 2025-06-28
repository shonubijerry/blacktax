# Family Money Transfer App

A Next.js application for managing family members and money transfers using the Family Money Transfer API.

## Features

- **Family Member Management**
  - Add, edit, and delete family members
  - View member details including balance and account information
  - Search functionality for finding members
  - Active/inactive status tracking

- **Money Transfers**
  - Create transfers to multiple recipients
  - View transfer history with status tracking
  - Support for custom references and descriptions
  - Real-time balance updates

- **Modern UI**
  - Responsive design with Tailwind CSS
  - Clean, intuitive interface
  - Form validation and error handling
  - Loading states and user feedback

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Running instance of the Family Money Transfer API

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file and set your API URL:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8787
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout component
│   ├── page.tsx            # Main application page
│   └── globals.css         # Global styles
├── components/
│   ├── FamilyMemberForm.tsx # Form for creating/editing members
│   └── TransferForm.tsx     # Form for creating transfers
├── lib/
│   └── api.ts              # API client and type definitions
└── Configuration files...
```

## API Integration

The app integrates with the following API endpoints:

- `GET /family-members` - List family members with pagination and search
- `POST /family-members` - Create new family member
- `GET /family-members/:id` - Get specific family member
- `PUT /family-members/:id` - Update family member
- `DELETE /family-members/:id` - Delete family member
- `POST /transfer` - Create money transfer
- `GET /transfers` - List transfer history

## Usage

### Managing Family Members

1. **Adding Members**: Click "Add Member" to open the form with required fields:
   - Name, email, phone (required)
   - Account number and bank code (required)
   - Bank name and initial balance (optional)

2. **Editing Members**: Click "Edit" next to any member to modify their information

3. **Searching**: Use the search bar to find members by name or email

### Creating Transfers

1. Click "New Transfer" to open the transfer form
2. Select recipients from the dropdown (shows all active members)
3. Enter transfer amounts for each recipient
4. Add optional reference and description
5. Submit to process the transfer via Paystack

### Viewing Transfer History

Switch to the "Transfers" tab to see:
- All completed and pending transfers
- Transfer amounts and recipients
- Status indicators (success, pending, failed)
- Transfer dates and references

## Error Handling

The application includes comprehensive error handling:
- Form validation with user-friendly messages
- API error display with specific error details
- Loading states during API calls
- Confirmation dialogs for destructive actions

## Styling

Built with Tailwind CSS for:
- Responsive design across all screen sizes
- Consistent spacing and typography
- Modern color scheme and components
- Accessible form controls and navigation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
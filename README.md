# Cloudflare CMS - Personal Blog

A fully free, Cloudflare-native personal blog with:

- Dark Modern theme
- Admin SPA with WYSIWYG editor
- Scheduled posts & revisions
- Media uploads (R2)
- Giscus comments
- Cloudflare Access for admin protection
- Cloudflare Workers API
- D1 database + KV caching
- GitHub Actions for automatic deployment

## Features

### Frontend (Cloudflare Pages)
- Modern, responsive dark theme
- Clean typography with Inter font
- Post listing with summaries
- Individual post pages with markdown rendering
- Giscus comment integration
- Mobile-responsive design

### Admin Interface
- WYSIWYG editor using Quill.js
- Post creation and editing
- Slug auto-generation from title
- Post metadata (author, tags, summary)
- Draft/published status
- Post management (edit, delete)

### Backend (Cloudflare Workers + R2)
- RESTful API for CRUD operations
- R2 storage for post content
- Slug-based routing for SEO-friendly URLs
- CORS support for cross-origin requests

## Fixed Issues

The following issues have been identified and fixed:

1. **API Data Structure Mismatch**
   - Worker now supports full post metadata (slug, author, summary, tags, published)
   - Added slug-based routing for frontend
   - Proper ID-based routing for admin

2. **Admin Interface Issues**
   - Added missing `post-id` hidden input field
   - Added missing status box element
   - Added `marked.js` dependency for markdown parsing
   - Properly integrated Quill editor
   - Added author, tags, and published fields

3. **Editor Integration**
   - Fixed Quill editor integration in app.js
   - Proper content getting/setting functions
   - Auto-slug generation from title

4. **Frontend Pages**
   - Added error handling for API requests
   - Added markdown parsing with marked.js
   - Improved post page with back navigation
   - Added proper title updates

5. **Configuration**
   - Updated wrangler.toml to include BLOG R2 binding
   - Consistent binding names between config and worker code

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- Cloudflare account
- Wrangler CLI installed globally

### 1. Clone and Navigate
```bash
cd blog-josh-fisher
```

### 2. Install Dependencies
```bash
cd worker
npm install
cd ..
```

### 3. Configure Cloudflare Resources

#### Create R2 Bucket
```bash
wrangler r2 bucket create blog-josh-fisher
```

#### Create D1 Database
```bash
wrangler d1 create blog-josh-fisher
```

#### Create KV Namespace
```bash
wrangler kv:namespace create BLOG_CACHE
```

#### Update wrangler.toml
Replace the IDs in `wrangler.toml` with your actual IDs:
- `account_id` - Your Cloudflare account ID
- `bucket_name` - Your R2 bucket name
- `database_name` - Your D1 database name
- KV namespace ID

### 4. Deploy the Worker
```bash
wrangler publish
```

### 5. Deploy to Cloudflare Pages

#### Option 1: Using Git
1. Push this repo to GitHub
2. Create a new Cloudflare Pages project
3. Connect to your GitHub repo
4. Set build settings:
   - Build command: (empty)
   - Build output directory: `site`
5. Add custom domain if needed

#### Option 2: Using Wrangler
```bash
wrangler pages project create joshua-fisher-blog
wrangler pages deploy site --project-name=joshua-fisher-blog
```

### 6. Configure Custom Domain

Update the `PAGES_ORIGIN` in wrangler.toml to your Pages URL.

### 7. Setup Giscus Comments (Optional)

The blog is configured to use Giscus for comments. To set it up:

1. Install Giscus app on your GitHub repository
2. Update the Giscus configuration in `site/post.html`:
   - `data-repo`: Your repository (format: `owner/repo`)
   - `data-repo-id`: Your repository ID
   - `data-category`: Discussion category
   - `data-category-id`: Category ID

### 8. Protect Admin with Cloudflare Access (Optional)

To protect your admin panel:

1. Enable Cloudflare Access on your domain
2. Create an Access policy for `/admin/*`
3. Configure authentication method (email, GitHub, etc.)

## Usage

### Creating Posts

1. Navigate to `/admin/` on your blog
2. Fill in the post details:
   - Title (required)
   - Slug (auto-generated from title, can be customized)
   - Author
   - Tags (comma-separated)
   - Summary
   - Content (use the WYSIWYG editor)
3. Check/uncheck "Published" to control visibility
4. Click "Publish" to save

### Managing Posts

- **Edit**: Click the "Edit" button on any post
- **Delete**: Click the "Delete" button and confirm
- **Clear**: Click "Clear" to reset the form

## API Endpoints

### List All Posts
```
GET /api/posts
```
Returns array of posts with metadata.

### Get Single Post by Slug
```
GET /api/post/{slug}
```
Returns full post with content.

### Create Post
```
POST /api/post
Content-Type: application/json

{
  "title": "Post Title",
  "body": "Post content in HTML",
  "slug": "post-slug",
  "author": "Author Name",
  "tags": "tag1, tag2",
  "summary": "Post summary",
  "published": true
}
```

### Update Post
```
PUT /api/post/{id}
Content-Type: application/json

{
  "title": "Updated Title",
  "body": "Updated content",
  // ... other fields
}
```

### Delete Post
```
DELETE /api/post/{id}
```

## Development

### Local Development with Wrangler

```bash
# Start worker locally
cd worker
wrangler dev

# In another terminal, serve the site
cd site
npx serve
```

### Testing

1. Start the worker: `wrangler dev`
2. Navigate to your local Pages URL
3. Test post creation, editing, and deletion

## Troubleshooting

### Posts not appearing
- Check worker logs: `wrangler tail`
- Verify R2 bucket exists and is accessible
- Check CORS settings

### Admin panel not working
- Ensure worker is deployed and accessible
- Check browser console for errors
- Verify API URLs are correct

### Giscus comments not loading
- Verify repository has Discussions enabled
- Check Giscus app is installed
- Ensure data attributes are correct

## Project Structure

```
blog-josh-fisher/
├── site/                  # Frontend files
│   ├── admin/            # Admin interface
│   │   ├── index.html
│   │   ├── app.js
│   │   └── editor.js
│   ├── assets/
│   │   └── styles.css
│   ├── index.html        # Homepage
│   └── post.html         # Post page
├── worker/               # Cloudflare Worker
│   ├── index.js
│   └── package.json
├── sql/                  # Database schemas (if needed)
├── wrangler.toml        # Cloudflare configuration
└── README.md
```

## Contributing

Feel free to fork and customize this blog for your needs!

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

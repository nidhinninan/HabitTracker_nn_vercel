const { Client } = require('@notionhq/client');

const notion = new Client({
    auth: process.env.NOTION_KEY,
});

const databaseId = process.env.NOTION_DB_ID;

/**
 * Vercel Serverless Function: GET /api/load
 * Fetches today's habit entry from Notion database
 */
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.NOTION_KEY || !process.env.NOTION_DB_ID) {
        console.error('Missing Notion configuration');
        return res.status(500).json({ error: 'Notion API not configured' });
    }

    try {
        const today = new Date().toISOString().split('T')[0];

        // Query Notion database for today's entry
        const response = await notion.databases.query({
            database_id: databaseId.replace(/-/g, ''),
            filter: {
                property: 'Date',
                title: {
                    equals: today,
                },
            },
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ],
        });

        if (response.results.length === 0) {
            return res.status(200).json({
                found: false,
                date: today,
                habits: [],
                completedToday: {},
                notes: '',
            });
        }

        // Parse the latest entry
        const page = response.results[0];
        const properties = page.properties;

        // Extract habits array from rich_text
        const habitsText = properties.Habits?.rich_text?.[0]?.plain_text || '';
        const habits = habitsText
            ? habitsText.split(',').map(h => h.trim()).filter(h => h)
            : [];

        // Extract completed habits
        const completedText = properties.Completed?.rich_text?.[0]?.plain_text || '';
        const completed = completedText && completedText !== '(None)'
            ? completedText.split(',').map(h => h.trim()).filter(h => h)
            : [];

        // Create completedToday object
        const completedToday = {};
        completed.forEach(completedHabit => {
            const index = habits.indexOf(completedHabit);
            if (index !== -1) {
                completedToday[index] = true;
            }
        });

        // Extract notes
        const notes = properties.Notes?.rich_text?.[0]?.plain_text || '';

        return res.status(200).json({
            found: true,
            date: today,
            habits,
            completedToday,
            notes: notes === '(No notes)' ? '' : notes,
            pageId: page.id,
        });
    } catch (error) {
        console.error('Notion API error:', error);
        console.error('Database ID used:', databaseId);
        console.error('Error stack:', error.stack);

        if (error.code === 'unauthorized') {
            return res.status(401).json({ error: 'Invalid Notion API key' });
        }

        if (error.code === 'object_not_found') {
            return res.status(404).json({ error: 'Database not found. Check NOTION_DB_ID' });
        }

        return res.status(500).json({
            error: 'Failed to load from Notion',
            message: error.message,
        });
    }
};

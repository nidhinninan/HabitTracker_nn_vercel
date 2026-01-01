const { Client } = require('@notionhq/client');

const notion = new Client({
    auth: process.env.NOTION_KEY,
});

const databaseId = process.env.NOTION_DB_ID;

/**
 * Vercel Serverless Function: POST /api/sync
 * Creates or updates today's habit entry in Notion database
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

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.NOTION_KEY || !process.env.NOTION_DB_ID) {
        console.error('Missing Notion configuration');
        return res.status(500).json({ error: 'Notion API not configured', message: 'Check environment variables' });
    }

    try {
        const { date, habits, completed, completionPercentage, notes } = req.body;

        if (!date || !Array.isArray(habits)) {
            return res.status(400).json({ error: 'Invalid request payload' });
        }

        // First, check if entry for today exists
        const queryResponse = await notion.databases.query({
            database_id: databaseId,
            filter: {
                property: 'Date',
                date: {
                    equals: date,
                },
            },
        });

        let pageId = null;
        if (queryResponse.results.length > 0) {
            // Entry exists - get its ID
            pageId = queryResponse.results[0].id;
        }

        const pageProperties = {
            'Date': {
                title: [
                    {
                        text: {
                            content: date,
                        },
                    },
                ],
            },
            'Habits': {
                rich_text: [
                    {
                        text: {
                            content: habits.join(', '),
                        },
                    },
                ],
            },
            'Completed': {
                rich_text: [
                    {
                        text: {
                            content: completed.length > 0 ? completed.join(', ') : '(None)',
                        },
                    },
                ],
            },
            'Progress': {
                number: completionPercentage,
            },
            'Notes': {
                rich_text: [
                    {
                        text: {
                            content: notes || '(No notes)',
                        },
                    },
                ],
            },
        };

        let response;

        if (pageId) {
            // Update existing page
            response = await notion.pages.update({
                page_id: pageId,
                properties: pageProperties,
            });
        } else {
            // Create new page
            response = await notion.pages.create({
                parent: {
                    database_id: databaseId,
                },
                properties: pageProperties,
            });
        }

        return res.status(201).json({
            success: true,
            notionPageId: response.id,
            message: pageId ? 'Updated in Notion' : 'Created in Notion',
            isUpdate: !!pageId,
        });
    } catch (error) {
        console.error('Notion API error:', error);

        if (error.code === 'unauthorized') {
            return res.status(401).json({ error: 'Invalid Notion API key', message: error.message });
        }

        if (error.code === 'object_not_found') {
            return res.status(404).json({ error: 'Database not found', message: 'Check NOTION_DB_ID' });
        }

        return res.status(500).json({
            error: 'Failed to sync to Notion',
            message: error.message,
        });
    }
};

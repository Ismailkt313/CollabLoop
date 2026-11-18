import { ContributorRole } from '../models/index.js';

/** Default catalogue of roles seeded when none exist. */
const DEFAULT_ROLES = [
  {
    name: 'Backend Developer',
    description: 'Builds robust APIs, manages databases, and designs server-side architecture.',
    imageUrl: '',
  },
  {
    name: 'Frontend Developer',
    description: 'Creates responsive web interfaces, user flows, and interactive components.',
    imageUrl: '',
  },
  {
    name: 'Full Stack Developer',
    description: 'Works across client and server stacks to deliver end-to-end features.',
    imageUrl: '',
  },
  {
    name: 'UI/UX Designer',
    description: 'Designs user journeys, wireframes, prototypes, and design systems.',
    imageUrl: '',
  },
  {
    name: 'QA Engineer',
    description: 'Ensures quality, writes automated tests, and verifies user workflows.',
    imageUrl: '',
  },
  {
    name: 'DevOps Engineer',
    description: 'Manages CI/CD pipelines, containerization, cloud infrastructure, and deployment.',
    imageUrl: '',
  },
  {
    name: 'Project Manager',
    description: 'Coordinates milestones, team sprints, delivery timelines, and roadmap.',
    imageUrl: '',
  },
];

/**
 * Seed default contributor roles if they do not already exist.
 */
async function ensureDefaultRoles() {
  for (const role of DEFAULT_ROLES) {
    const normalizedName = role.name.toLowerCase().trim();
    await ContributorRole.updateOne(
      { normalizedName },
      {
        $setOnInsert: {
          name: role.name,
          normalizedName,
          description: role.description,
          imageUrl: role.imageUrl || '',
          cloudinaryPublicId: '',
          createdBy: null,
        },
      },
      { upsert: true }
    );
  }
}

/**
 * GET /api/roles
 * Retrieve all platform-wide contributor roles.
 */
export async function listRoles(req, res, next) {
  try {
    await ensureDefaultRoles();

    const query = String(req.query.q || '').trim().toLowerCase();
    const filter = query
      ? {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
          ],
        }
      : {};

    const roles = await ContributorRole.find(filter).sort({ name: 1 });
    res.json({ roles });
  } catch (err) {
    next(err);
  }
}

export async function createRole(req, res, next) {
  try {
    const rawName = String(req.body.name || '').trim();

    if (!rawName) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    if (rawName.length < 2 || rawName.length > 60) {
      return res.status(400).json({ error: 'Role name must be between 2 and 60 characters' });
    }

    const normalizedName = rawName.toLowerCase();

    const existing = await ContributorRole.findOne({ normalizedName });
    if (existing) {
      return res.status(409).json({ error: 'A contributor role with this name already exists' });
    }

    const role = await ContributorRole.create({
      name: rawName,
      normalizedName,
      description: String(req.body.description || '').trim().slice(0, 300),
      imageUrl: String(req.body.imageUrl || '').trim(),
      cloudinaryPublicId: String(req.body.cloudinaryPublicId || '').trim(),
      createdBy: req.user?.id || null,
    });

    res.status(201).json({ role });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A contributor role with this name already exists' });
    }
    next(err);
  }
}

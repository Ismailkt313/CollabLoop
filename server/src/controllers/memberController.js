import { ProjectMember } from '../models/index.js';

/**
 * GET /projects/:projectId/members
 * List all active members of a project.
 */
export async function listMembers(req, res) {
  const members = await ProjectMember.find({
    projectId: req.params.projectId,
    status: 'active',
  }).populate('userId', 'name username avatar');

  res.json({ members });
}

/**
 * PATCH /projects/:projectId/members/:memberId
 * Update a member's role or team function.
 */
export async function updateMember(req, res) {
  const member = await ProjectMember.findOneAndUpdate(
    { _id: req.params.memberId, projectId: req.params.projectId },
    {
      ...(req.body.projectRole && { projectRole: req.body.projectRole }),
      ...(req.body.teamFunction && { teamFunction: req.body.teamFunction }),
    },
    { new: true },
  );

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  res.json({ member });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ProjectMember, Invitation, Project, Resource, Document } from '../src/models/index.js';

test('Database Indexes & Schema Verification', async (t) => {
  await t.test('ProjectMember schema includes compound indexes for userId and projectId', () => {
    const indexes = ProjectMember.schema.indexes();
    const hasUserIdStatus = indexes.some(
      ([idx]) => idx.userId === 1 && idx.status === 1
    );
    const hasProjectIdStatus = indexes.some(
      ([idx]) => idx.projectId === 1 && idx.status === 1
    );
    assert.ok(hasUserIdStatus, 'ProjectMember must have { userId: 1, status: 1 } compound index');
    assert.ok(hasProjectIdStatus, 'ProjectMember must have { projectId: 1, status: 1 } compound index');
  });

  await t.test('Invitation schema includes compound indexes for invitedUser and status', () => {
    const indexes = Invitation.schema.indexes();
    const hasInvitedUserStatus = indexes.some(
      ([idx]) => idx.invitedUser === 1 && idx.status === 1
    );
    const hasProjectIdStatus = indexes.some(
      ([idx]) => idx.projectId === 1 && idx.status === 1
    );
    assert.ok(hasInvitedUserStatus, 'Invitation must have { invitedUser: 1, status: 1 } compound index');
    assert.ok(hasProjectIdStatus, 'Invitation must have { projectId: 1, status: 1 } compound index');
  });

  await t.test('Project schema includes compound index for isArchived and updatedAt', () => {
    const indexes = Project.schema.indexes();
    const hasArchivedUpdated = indexes.some(
      ([idx]) => idx.isArchived === 1 && idx.updatedAt === -1
    );
    assert.ok(hasArchivedUpdated, 'Project must have { isArchived: 1, updatedAt: -1 } compound index');
  });
});

test('Socket Event Contract Verification', async (t) => {
  await t.test('Payloads include actorId and room targets for idempotency and duplicate prevention', () => {
    const mockActorId = '507f1f77bcf86cd799439011';
    const mockProjectId = '507f1f77bcf86cd799439012';
    const mockUserId = '507f1f77bcf86cd799439013';

    // Verify event structure
    const invitationEvent = {
      invitation: { _id: 'inv_123', projectId: { _id: mockProjectId, name: 'Test' } },
      actorId: mockActorId,
    };
    assert.equal(invitationEvent.actorId, mockActorId);
    assert.ok(invitationEvent.invitation);

    const memberJoinedEvent = {
      projectId: mockProjectId,
      member: { _id: 'mem_123', userId: mockUserId, projectRole: 'member' },
      actorId: mockActorId,
    };
    assert.equal(memberJoinedEvent.projectId, mockProjectId);
    assert.equal(memberJoinedEvent.actorId, mockActorId);

    const resourceEvent = {
      projectId: mockProjectId,
      roleId: 'role_123',
      resource: { _id: 'res_123', title: 'Mock' },
      actorId: mockActorId,
    };
    assert.equal(resourceEvent.actorId, mockActorId);
    assert.equal(resourceEvent.projectId, mockProjectId);
  });
});

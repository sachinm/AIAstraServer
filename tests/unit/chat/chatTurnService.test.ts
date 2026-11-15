import { describe, expect, it, vi } from 'vitest';
import { ChatTurnService } from '../../../src/chat/chatTurnService.js';

describe('ChatTurnService', () => {
  it('initializes an active turn with pending status and seq 0', async () => {
    const mockPrisma = {
      chatTurn: {
        create: vi.fn().mockResolvedValue({ id: 'turn-123' }),
        update: vi.fn().mockResolvedValue({ id: 'turn-123' }),
        findUnique: vi.fn(),
      },
    };

    const service = new ChatTurnService();
    const turn = await service.createTurn(mockPrisma as any, {
      userId: 'user-abc',
      kundliId: 'kundli-xyz',
      sessionId: 'session-456',
      question: 'Will I travel abroad this year?',
      ticket: null,
    });

    expect(turn.turnId).toBe('turn-123');
    expect(turn.seq).toBe(0);
    expect(turn.status).toBe('pending');
    expect(turn.events).toHaveLength(0);
    expect(mockPrisma.chatTurn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-abc',
          question: 'Will I travel abroad this year?',
          status: 'pending',
          seq: 0,
        }),
      })
    );
  });

  it('increments monotonic seq on each recorded event and buffers tokens', async () => {
    const mockPrisma = {
      chatTurn: {
        create: vi.fn().mockResolvedValue({ id: 'turn-123' }),
        update: vi.fn().mockResolvedValue({ id: 'turn-123' }),
        findUnique: vi.fn(),
      },
    };

    const service = new ChatTurnService();
    const turn = await service.createTurn(mockPrisma as any, {
      userId: 'user-abc',
      kundliId: 'kundli-xyz',
      question: 'Career forecast?',
      ticket: null,
    });

    const receivedEvents: any[] = [];
    turn.emitter.on('event', (ev) => receivedEvents.push(ev));
    turn.emitter.on('error', () => {});

    await service.recordEvent(mockPrisma as any, turn.turnId, 'reading_stage', { stage: 'transit_analysis' });
    await service.recordEvent(mockPrisma as any, turn.turnId, 'token', { text: 'You are entering ' });
    await service.recordEvent(mockPrisma as any, turn.turnId, 'token', { text: 'a Jupiter sub-period.' });
    await service.completeTurn(mockPrisma as any, turn.turnId, { totalTokens: 12 });

    expect(receivedEvents).toHaveLength(4);
    expect(receivedEvents[0].seq).toBe(1);
    expect(receivedEvents[0].type).toBe('reading_stage');
    expect(receivedEvents[1].seq).toBe(2);
    expect(receivedEvents[1].content.text).toBe('You are entering ');
    expect(receivedEvents[2].seq).toBe(3);
    expect(receivedEvents[3].seq).toBe(4);
    expect(receivedEvents[3].type).toBe('turn_done');

    // Verify recovery of buffered events
    const replayed = service.getEventsSince(turn.turnId, 1);
    expect(replayed).toHaveLength(3);
    expect(replayed[0].seq).toBe(2);
    expect(replayed[1].seq).toBe(3);
    expect(replayed[2].seq).toBe(4);
  });

  it('handles turn failure and marks status as failed with seq', async () => {
    const mockPrisma = {
      chatTurn: {
        create: vi.fn().mockResolvedValue({ id: 'turn-fail' }),
        update: vi.fn().mockResolvedValue({ id: 'turn-fail' }),
        findUnique: vi.fn(),
      },
    };

    const service = new ChatTurnService();
    const turn = await service.createTurn(mockPrisma as any, {
      userId: 'user-abc',
      kundliId: 'kundli-xyz',
      question: 'Testing error flow',
      ticket: null,
    });

    turn.emitter.on('error', () => {});

    await service.failTurn(mockPrisma as any, turn.turnId, 'Upstream astrology engine timeout');
    const inMem = service.getActiveTurn(turn.turnId);
    expect(inMem?.status).toBe('failed');
    expect(mockPrisma.chatTurn.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'turn-fail' },
        data: expect.objectContaining({
          status: 'failed',
          error: 'Upstream astrology engine timeout',
        }),
      })
    );
  });
});

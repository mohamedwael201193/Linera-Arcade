/**
 * Chain Resolution Receiver
 * 
 * ARCHITECTURE:
 * - Executor is the ONLY component that touches the chain
 * - Executor resolves rounds on-chain
 * - Executor sends HTTP POST to backend with resolution data
 * - Backend updates DB based on executor notifications
 * 
 * NO chain querying, NO linera service, NO 8080 port
 */

import { getDb } from '../db/selector.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RoundResolutionNotification {
  round_id: number;
  asset: 'BTC' | 'ETH';
  end_price: number;  // Price in cents
  winning_direction: 'UP' | 'DOWN';
  resolved_at: string; // ISO timestamp
  tx_hash?: string;    // Optional on-chain transaction reference
}

// Track received notifications to avoid duplicates
const processedNotifications = new Set<string>();

// Stats
let totalReceived = 0;
let totalProcessed = 0;
let lastNotificationAt: Date | null = null;

// =============================================================================
// NOTIFICATION HANDLER
// =============================================================================

/**
 * Process a round resolution notification from the executor
 * Called by the API route when executor POSTs resolution data
 * 
 * IMPORTANT: round_id in notification is the ON-CHAIN round ID
 */
export async function handleRoundResolution(notification: RoundResolutionNotification): Promise<{
  success: boolean;
  message: string;
  alreadyProcessed?: boolean;
}> {
  totalReceived++;
  lastNotificationAt = new Date();
  
  const notificationKey = `${notification.round_id}-${notification.end_price}`;
  
  // Check for duplicate
  if (processedNotifications.has(notificationKey)) {
    console.log(`⏭️ [ChainReceiver] Duplicate notification for on-chain round ${notification.round_id}, skipping`);
    return {
      success: true,
      message: 'Already processed',
      alreadyProcessed: true,
    };
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`🔗 [ChainReceiver] RESOLUTION NOTIFICATION RECEIVED`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   On-Chain Round ID: ${notification.round_id}`);
  console.log(`   Asset: ${notification.asset}`);
  console.log(`   End Price: $${notification.end_price / 100}`);
  console.log(`   Winning Direction: ${notification.winning_direction}`);
  console.log(`   Resolved At: ${notification.resolved_at}`);
  if (notification.tx_hash) {
    console.log(`   TX Hash: ${notification.tx_hash}`);
  }
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    const db = await getDb();
    
    // IMPORTANT: Look up by ON-CHAIN round ID, not DB ID
    const existingRound = await db.getCryptoRoundByOnchainId(notification.round_id);
    
    if (!existingRound) {
      console.log(`⚠️ [ChainReceiver] No DB round linked to on-chain ID ${notification.round_id}`);
      return {
        success: false,
        message: `No database round linked to on-chain ID ${notification.round_id}`,
      };
    }

    console.log(`   ➡️ Found DB round: id=${existingRound.id}, onchain_id=${existingRound.onchain_round_id}`);

    if (existingRound.status === 'RESOLVED') {
      console.log(`ℹ️ [ChainReceiver] Round ${existingRound.id} (on-chain ${notification.round_id}) already resolved in DB`);
      processedNotifications.add(notificationKey);
      return {
        success: true,
        message: 'Round already resolved',
        alreadyProcessed: true,
      };
    }

    // Resolve the round in DB by ON-CHAIN ID (handles predictions and payouts)
    const resolved = await db.resolveCryptoRoundByOnchainId(notification.round_id, notification.end_price);
    
    if (resolved) {
      processedNotifications.add(notificationKey);
      totalProcessed++;
      
      console.log(`✅ [ChainReceiver] DB UPDATED: Round ${resolved.id} (on-chain ${notification.round_id})`);
      console.log(`   Start Price: $${existingRound.start_price / 100}`);
      console.log(`   End Price: $${notification.end_price / 100}`);
      console.log(`   Direction: ${resolved.winning_direction}`);
      console.log('');
      
      return {
        success: true,
        message: `Round resolved successfully (DB id=${resolved.id}, on-chain id=${notification.round_id})`,
      };
    } else {
      console.log(`❌ [ChainReceiver] Failed to resolve round (on-chain ${notification.round_id})`);
      return {
        success: false,
        message: `Failed to resolve round (on-chain ${notification.round_id})`,
      };
    }
    
  } catch (error) {
    console.error(`❌ [ChainReceiver] Error processing notification:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// STATUS
// =============================================================================

export function getReceiverStatus(): {
  totalReceived: number;
  totalProcessed: number;
  lastNotificationAt: string | null;
  processedRoundsCount: number;
} {
  return {
    totalReceived,
    totalProcessed,
    lastNotificationAt: lastNotificationAt?.toISOString() || null,
    processedRoundsCount: processedNotifications.size,
  };
}

// Legacy exports for compatibility
export function startChainIndexer(): void {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📥 CHAIN RESOLUTION RECEIVER READY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Waiting for resolution notifications from Rust executor...');
  console.log('   Endpoint: POST /api/internal/resolve-round');
  console.log('');
  console.log('   Architecture:');
  console.log('   • Executor resolves rounds ON-CHAIN');
  console.log('   • Executor POSTs resolution to backend');
  console.log('   • Backend updates DB (mirrors chain state)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
}

export function stopChainIndexer(): void {
  console.log('🛑 [ChainReceiver] Stopped');
}

export function getIndexerStatus() {
  const status = getReceiverStatus();
  return {
    running: true,
    configured: true,
    mode: 'receiver',
    ...status,
  };
}

export default {
  start: startChainIndexer,
  stop: stopChainIndexer,
  status: getIndexerStatus,
  handleResolution: handleRoundResolution,
};

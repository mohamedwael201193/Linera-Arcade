/**
 * Linera Adapter - Singleton managing all Linera blockchain interactions
 * 
 * This is the single point of contact with @linera/client.
 * All other code should use this adapter instead of importing @linera/client directly.
 */

import { Faucet, Client, Wallet, Application } from '@linera/client';
import type { Wallet as DynamicWallet } from '@dynamic-labs/sdk-react-core';
import { ensureWasmInitialized } from './wasmInit';
import { DynamicSigner } from './dynamicSigner';

// Environment configuration
const DEFAULT_FAUCET_URL = 'https://faucet.testnet-conway.linera.net';
const APPLICATION_ID = import.meta.env.VITE_APPLICATION_ID;

// Validate APPLICATION_ID at module load
if (!APPLICATION_ID || APPLICATION_ID === '' || APPLICATION_ID === 'placeholder') {
  console.error('❌ VITE_APPLICATION_ID is not set or invalid!');
  console.error('Expected format: 64-character hex string');
}

/**
 * Connection state after wallet connect
 */
export interface LineraConnection {
  client: Client;
  wallet: Wallet;
  faucet: Faucet;
  chainId: string;
  address: string;
  signer: DynamicSigner;
}

/**
 * Application connection state
 */
export interface ApplicationConnection {
  application: Application;
  applicationId: string;
}

/**
 * Listener callback type for state changes
 */
type StateChangeListener = () => void;

/**
 * LineraAdapter - Singleton class managing Linera connections
 */
class LineraAdapterClass {
  private static instance: LineraAdapterClass | null = null;
  
  // Connection state
  private connection: LineraConnection | null = null;
  private appConnection: ApplicationConnection | null = null;
  private connectPromise: Promise<LineraConnection> | null = null;
  
  // Listeners for state changes
  private listeners: Set<StateChangeListener> = new Set();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): LineraAdapterClass {
    if (!LineraAdapterClass.instance) {
      LineraAdapterClass.instance = new LineraAdapterClass();
    }
    return LineraAdapterClass.instance;
  }

  /**
   * Connect to Linera network using Dynamic wallet
   * 
   * This will:
   * 1. Initialize WASM (if not already done)
   * 2. Connect to Conway faucet
   * 3. Create a Linera wallet
   * 4. Claim a microchain for the user's EVM address
   * 5. Create a Client with DynamicSigner
   * 
   * @param dynamicWallet - The connected Dynamic wallet
   * @param faucetUrl - Optional faucet URL override
   * @returns LineraConnection with client, wallet, chainId, etc.
   */
  async connect(
    dynamicWallet: DynamicWallet,
    faucetUrl: string = DEFAULT_FAUCET_URL
  ): Promise<LineraConnection> {
    const userAddress = dynamicWallet.address?.toLowerCase();
    
    if (!userAddress) {
      throw new Error('Dynamic wallet has no address');
    }

    // If already connected with same address, return existing connection
    if (this.connection && this.connection.address === userAddress) {
      console.log('✅ Already connected to Linera');
      return this.connection;
    }

    // If connection in progress, wait for it
    if (this.connectPromise) {
      console.log('⏳ Connection in progress, waiting...');
      return this.connectPromise;
    }

    // Start new connection
    this.connectPromise = this.performConnect(dynamicWallet, faucetUrl, userAddress);
    
    try {
      const connection = await this.connectPromise;
      return connection;
    } finally {
      this.connectPromise = null;
    }
  }

  /**
   * Internal connection implementation
   */
  private async performConnect(
    dynamicWallet: DynamicWallet,
    faucetUrl: string,
    userAddress: string
  ): Promise<LineraConnection> {
    try {
      console.log('🔄 Connecting to Linera...');
      
      // Step 1: Initialize WASM
      await ensureWasmInitialized();
      
      // Step 2: Create faucet connection
      console.log(`📡 Connecting to faucet: ${faucetUrl}`);
      const faucet = new Faucet(faucetUrl);
      
      // Step 3: Create Linera wallet from faucet (gets genesis config)
      console.log('👛 Creating Linera wallet...');
      const wallet = await faucet.createWallet();
      
      // Step 4: Claim a microchain for the user's EVM address
      console.log(`⛓️ Claiming microchain for ${userAddress}...`);
      const chainId = await faucet.claimChain(wallet, userAddress);
      console.log(`✅ Claimed chain: ${chainId}`);
      
      // Step 5: Create signer from Dynamic wallet
      const signer = new DynamicSigner(dynamicWallet);
      
      // Step 6: Create Linera client with wallet and signer
      // Note: The Client constructor returns a Promise in wasm-bindgen
      console.log('🔗 Creating Linera client...');
      const clientResult = new Client(wallet, signer);
      // Await the client creation (wasm-bindgen returns promise from constructor)
      const client = await (clientResult as unknown as Promise<Client>);
      
      // Store connection
      this.connection = {
        client,
        wallet,
        faucet,
        chainId,
        address: userAddress,
        signer,
      };
      
      console.log('✅ Connected to Linera successfully!');
      console.log(`   Chain ID: ${chainId}`);
      console.log(`   Address: ${userAddress}`);
      
      // Note: notifications are set up when connecting to application (on Chain, not Client)
      
      this.notifyListeners();
      return this.connection;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to connect to Linera:', message);
      this.connection = null;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Connect to the Arcade Hub application
   * 
   * @param applicationId - Optional override for application ID
   * @returns ApplicationConnection with application instance
   */
  async connectApplication(
    applicationId: string = APPLICATION_ID
  ): Promise<ApplicationConnection> {
    if (!this.connection) {
      throw new Error('Must connect wallet before connecting to application');
    }

    if (!applicationId) {
      throw new Error('Application ID is not configured');
    }

    // If already connected to same application, return existing
    if (this.appConnection && this.appConnection.applicationId === applicationId) {
      console.log('✅ Already connected to application');
      return this.appConnection;
    }

    try {
      console.log(`🎮 Connecting to application: ${applicationId.slice(0, 16)}...`);
      
      // Get chain instance first, then get application
      const chain = await this.connection.client.chain(this.connection.chainId);
      const application = await chain.application(applicationId);
      
      // Set up notifications on the chain for real-time updates
      this.setupChainNotifications(chain);
      
      this.appConnection = {
        application,
        applicationId,
      };
      
      console.log('✅ Connected to Arcade Hub application!');
      this.notifyListeners();
      return this.appConnection;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to connect to application:', message);
      this.appConnection = null;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Execute a GraphQL query against the application
   * 
   * @param graphqlQuery - GraphQL query string
   * @param variables - Optional variables for the query
   * @returns Parsed JSON response
   */
  async query<T = unknown>(
    graphqlQuery: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    if (!this.appConnection) {
      throw new Error('Must connect to application before querying');
    }

    const payload = variables
      ? { query: graphqlQuery, variables }
      : { query: graphqlQuery };

    try {
      const result = await this.appConnection.application.query(
        JSON.stringify(payload)
      );
      
      const parsed = JSON.parse(result);
      
      // Check for GraphQL errors
      if (parsed.errors && parsed.errors.length > 0) {
        const firstError = parsed.errors[0];
        throw new Error(firstError.message || 'GraphQL error');
      }
      
      return parsed.data as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Query failed:', message);
      throw error;
    }
  }

  /**
   * Execute a GraphQL mutation against the application
   * This triggers a blockchain transaction that requires wallet signing.
   * 
   * @param graphqlMutation - GraphQL mutation string
   * @param variables - Optional variables for the mutation
   * @returns Parsed JSON response
   */
  async mutate<T = unknown>(
    graphqlMutation: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    // Mutations use the same interface as queries in Linera
    // The client handles distinguishing based on GraphQL operation type
    return this.query<T>(graphqlMutation, variables);
  }

  /**
   * Set up notification listener on a chain for real-time updates
   */
  private setupChainNotifications(chain: { onNotification: (handler: (notification: unknown) => void) => void }): void {
    try {
      chain.onNotification((notification: unknown) => {
        const notif = notification as { reason?: { NewBlock?: unknown } };
        if (notif.reason?.NewBlock) {
          console.log('📦 New block received, notifying listeners...');
          this.notifyListeners();
        }
      });
    } catch (error) {
      console.warn('⚠️ Could not set up notifications:', error);
    }
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.connection !== null;
  }

  /**
   * Check if application is connected
   */
  isApplicationConnected(): boolean {
    return this.appConnection !== null;
  }

  /**
   * Get current connection (may be null)
   */
  getConnection(): LineraConnection | null {
    return this.connection;
  }

  /**
   * Get current application connection (may be null)
   */
  getApplicationConnection(): ApplicationConnection | null {
    return this.appConnection;
  }

  /**
   * Get connected wallet address
   */
  getAddress(): string | null {
    return this.connection?.address ?? null;
  }

  /**
   * Get claimed chain ID
   */
  getChainId(): string | null {
    return this.connection?.chainId ?? null;
  }

  /**
   * Disconnect and clear all state
   */
  disconnect(): void {
    console.log('🔌 Disconnecting from Linera...');
    this.connection = null;
    this.appConnection = null;
    this.connectPromise = null;
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   * 
   * @param listener - Callback to invoke on state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }
}

// Export singleton instance
export const lineraAdapter = LineraAdapterClass.getInstance();

// Also export the class for testing
export { LineraAdapterClass };

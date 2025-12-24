/**
 * DynamicSigner - Adapts Dynamic wallet to Linera's Signer interface
 * 
 * This allows users to sign Linera transactions using their MetaMask or other
 * EVM wallets connected via Dynamic.
 */

import type { Signer } from '@linera/client';
import type { Wallet as DynamicWallet } from '@dynamic-labs/sdk-react-core';
import { isEthereumWallet } from '@dynamic-labs/ethereum';

/**
 * Convert Uint8Array to hex string (without 0x prefix)
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * DynamicSigner implements Linera's Signer interface using Dynamic wallet.
 * 
 * Uses personal_sign directly to avoid double-hashing that would occur
 * with signMessage(). This is critical for Linera signature verification.
 */
export class DynamicSigner implements Signer {
  private dynamicWallet: DynamicWallet;
  private cachedAddress: string | null = null;

  constructor(dynamicWallet: DynamicWallet) {
    this.dynamicWallet = dynamicWallet;
  }

  /**
   * Get the signer's address (lowercase hex with 0x prefix)
   */
  async address(): Promise<string> {
    if (this.cachedAddress) {
      return this.cachedAddress;
    }
    
    const address = this.dynamicWallet.address;
    if (!address) {
      throw new Error('Dynamic wallet has no address');
    }
    
    this.cachedAddress = address.toLowerCase();
    return this.cachedAddress;
  }

  /**
   * Check if this signer can sign for the given owner address
   */
  async containsKey(owner: string): Promise<boolean> {
    const myAddress = await this.address();
    return owner.toLowerCase() === myAddress;
  }

  /**
   * Sign a message for the given owner using personal_sign
   * 
   * CRITICAL: We use personal_sign directly via walletClient.request()
   * instead of signMessage() to avoid double-hashing. Linera expects
   * the signature of the raw bytes, not a hash of the bytes.
   * 
   * @param owner - The address that should sign (must match wallet address)
   * @param value - Raw bytes to sign
   * @returns Signature hex string
   */
  async sign(owner: string, value: Uint8Array): Promise<string> {
    const myAddress = await this.address();
    
    // Verify owner matches our wallet
    if (owner.toLowerCase() !== myAddress) {
      throw new Error(
        `Owner ${owner} does not match wallet address ${myAddress}`
      );
    }

    // Ensure this is an Ethereum wallet
    if (!isEthereumWallet(this.dynamicWallet)) {
      throw new Error('Dynamic wallet is not an Ethereum wallet');
    }

    try {
      // Get the wallet client from Dynamic
      const walletClient = await this.dynamicWallet.getWalletClient();
      
      // Convert bytes to hex string with 0x prefix
      const messageHex: `0x${string}` = `0x${uint8ArrayToHex(value)}`;
      const signerAddress: `0x${string}` = myAddress as `0x${string}`;

      // Use personal_sign directly to avoid double-hashing
      // personal_sign signs: "\x19Ethereum Signed Message:\n" + len(message) + message
      // But walletClient.request passes raw bytes which is what Linera needs
      const signature = await walletClient.request({
        method: 'personal_sign',
        params: [messageHex, signerAddress],
      });

      console.log('✅ Message signed successfully');
      return signature as string;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Signing failed:', message);
      throw new Error(`Failed to sign with Dynamic wallet: ${message}`);
    }
  }
}

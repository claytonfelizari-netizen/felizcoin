import {PublicKey} from '@solana/web3.js';
import {createUmi} from '@metaplex-foundation/umi-bundle-defaults';
import {createNoopSigner, publicKey, percentAmount} from '@metaplex-foundation/umi';
import {mplTokenMetadata, createV1, TokenStandard,
  getMetadataAccountDataSerializer} from '@metaplex-foundation/mpl-token-metadata';
import {toWeb3JsInstruction} from '@metaplex-foundation/umi-web3js-adapters';
import {TOKEN_PROGRAM_ID} from '@solana/spl-token';

export const METADATA_PROGRAM = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
export function metadataAddress(mint) {
  return PublicKey.findProgramAddressSync([
    Buffer.from('metadata'), METADATA_PROGRAM.toBuffer(), mint.toBuffer(),
  ], METADATA_PROGRAM)[0];
}
export function metadataInstruction(payer, mint, metadata) {
  // The builder uses no private keys and makes no RPC call. Signing happens later.
  const umi = createUmi('https://api.devnet.solana.com').use(mplTokenMetadata());
  const authority = createNoopSigner(publicKey(payer.toBase58()));
  const instructions = createV1(umi, {
    mint: publicKey(mint.toBase58()), authority, payer: authority,
    updateAuthority: authority,
    splTokenProgram: publicKey(TOKEN_PROGRAM_ID.toBase58()),
    name: metadata.name, symbol: metadata.symbol, uri: metadata.uri,
    sellerFeeBasisPoints: percentAmount(0), creators: null,
    tokenStandard: TokenStandard.Fungible, decimals: 9, isMutable: true,
  }).getInstructions();
  if (instructions.length !== 1) throw Error('Unexpected metadata instruction count');
  return toWeb3JsInstruction(instructions[0]);
}
export function decodeMetadata(data) {
  const [decoded] = getMetadataAccountDataSerializer().deserialize(data);
  return {...decoded, name: decoded.name.replace(/\0/g, ''),
    symbol: decoded.symbol.replace(/\0/g, ''), uri: decoded.uri.replace(/\0/g, '')};
}

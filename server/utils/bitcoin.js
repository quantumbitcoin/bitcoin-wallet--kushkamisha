'use strict'

/**
 * Bitcoin crypto module
 * @module server/utils/bitcoin.js
 * @see https://en.bitcoin.it/wiki/Wallet_import_format
 * @see https://medium.com/bitcraft/so-you-want-to-build-a-bitcoin-hd-wallet-part-1-8b27aa001ac3
 */

const crypto = require('crypto')
const hdkey = require('hdkey')
const bs58 = require('bs58')
const bip39 = require('bip39')
const sha256 = require('js-sha256')
const ripemd160 = require('ripemd160')

/**
 * Generate Bitcoin private key from pseudorandom number
 * @todo Make private key more random
 * @returns {Buffer} Bitcoin private key
 */
const generatePrKey = () => {
    const DH = crypto.createDiffieHellman(256)
    DH.generateKeys()
    const prKey = DH.getPrivateKey()

    return prKey
}

/**
 * BIP39
 * Creates mnemonic phrase from a private key
 * @param {Buffer} prkey - Private key 
 * @returns {string} Mnemonic phrase (24 words)
 */
const prKeyToMnemonic = prkey => {
    return bip39.entropyToMnemonic(prkey, bip39.wordlists.english)
}

/**
 * BIP39
 * @param {string} mnemonic - Mnemonic phrase from the Bitcoin wallet 
 * @param {string} passphrase - Passphrase for the mnemonic phrase
 * @returns {Buffer} Seed
 */
const mnemonicToSeed = (mnemonic, passphrase) => {
    return bip39.mnemonicToSeed(mnemonic, passphrase)
}

/**
 * Generate seed
 * @returns {string} Mnemonic phrse
 */
const generateMnemonic = () => {
    const prKeyBuffer = generatePrKey()
    const mnemonic = prKeyToMnemonic(prKeyBuffer)

    return mnemonic
}

/**
 * BIP44
 * Derives child using path from seed
 * @param {string} seed - Seed
 * @param {string} path - Path to the child in the tree (according to BIP44)
 * @returns {object} Child's public & private keys
 */
const deriveChild = (seed, path) => {
    const root = hdkey.fromMasterSeed(seed)
    const child = root.derive(path)
    
    return {
        publicKey: child.publicKey,
        privateKey: child.privateKey
    }
}

/**
 * Converts private key from binary to the WIF format
 * @param {Buffer} prkey - Private key
 * @returns {string} Private key in the WIF format
 */
const prKeyToWIF = (prkey, network='mainnet') => {

    const networkPrefixes = {
        mainnet: '80',
        testnet: 'EF'
    }

    const prefix = network === 'testnet' ?
        networkPrefixes.testnet :
        networkPrefixes.mainnet

    // Add 0x80 byte to denote mainnet address
    const prefixBuff = Buffer.from(prefix, 'hex')
    prkey = Buffer.concat([prefixBuff, prkey])

    // Perform sha256 hashing two times
    const hash1 = crypto.createHash('sha256').update(prkey).digest()
    const hash2 = crypto.createHash('sha256').update(hash1).digest()

    // Get first 4 bytes to create checksum
    const checksum = hash2.slice(0, 4)

    // Add checksum to the end of private key with prefix
    prkey = Buffer.concat([prkey, checksum])

    // Convert private key to base58 format
    return bs58.encode(prkey)
}

/**
 * Create hash for the public key to use it in address creation prosess
 * @param {string} publicKey - Public key
 * @returns {Buffer} Hash of public key
 */
const createPublicKeyHash = publicKey => {
    const hash = sha256(Buffer.from(publicKey, 'hex'))
    const publicKeyHash = new ripemd160().update(Buffer.from(hash, 'hex')).digest()

    return publicKeyHash
}

/**
 * Create compressed bitcoin address from public key hash
 * @param {Buffre} publicKeyHash - Hash of a public key
 * @returns {string} Bitcoin address
 */
const createPublicAddress = publicKeyHash => {
    // step 1 - add prefix "00" in hex
    const step1 = Buffer.from('00' + publicKeyHash.toString('hex'), 'hex')
    // step 2 - create SHA256 hash of step 1
    const step2 = sha256(step1)
    // step 3 - create SHA256 hash of step 2
    const step3 = sha256(Buffer.from(step2, 'hex'))
    // step 4 - find the 1st byte of step 3 - save as "checksum"
    const checksum = step3.substring(0, 8)
    // step 5 - add step 1 + checksum
    const step4 = step1.toString('hex') + checksum
    console.log({ step4 })
    // return base 58 encoding of step 5
    const address = bs58.encode(Buffer.from(step4, 'hex'))

    return address
}

/**
 * Create bitcoin address using mnemonic phrase.
 * @param {string} mnemonic - Mnemonic phrase
 * @param {boolean} isChange - Is new address will be used to receive chnge or not
 * @param {number} userId - ID of the user, who ownes mnemonic phrase
 * @returns {Object} Address, public key and private key
 */
const createAddress = (mnemonic, isChange, currentPrKeyId) => {
    const seed = mnemonicToSeed(mnemonic)

    let path = `m/44'/0'/0'`
    path = isChange ? path + '/1' : path + '/0'
    path += `/${currentPrKeyId}`

    const child = deriveChild(seed, path)
    const publicKeyHash = createPublicKeyHash(child.publicKey)
    const address = createPublicAddress(publicKeyHash)
    const publicKey = child.publicKey.toString('hex')
    const privateKey = child.privateKey.toString('hex')

    return { address, publicKey, privateKey }
}

module.exports = {
    generatePrKey,
    prKeyToMnemonic,
    mnemonicToSeed,
    generateMnemonic,
    deriveChild,
    prKeyToWIF,
    createPublicKeyHash,
    createPublicAddress,
    createAddress,
}
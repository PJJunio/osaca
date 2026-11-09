import {DeviceSession, MlsGroupSession, ensureCryptoWasmReady} from '../packages/osaca_crypto/src/index.ts';

ensureCryptoWasmReady();
const devA = DeviceSession.create('userA', 'devA');
const devB = DeviceSession.create('userB', 'devB');

const kpB = devB.generateKeyPackage();
const grpA = MlsGroupSession.create(devA, new TextEncoder().encode('test-grp'));
const addRes = grpA.addMember(kpB);
const grpB = MlsGroupSession.joinFromWelcome(devB, addRes.welcome);

const ct = grpA.encryptMessage(new TextEncoder().encode('Hello from A!'));

console.log('Testing grpB decrypting ct from A:');
const procB = grpB.processMessage(ct);
console.log('B result:', procB.type, new TextDecoder().decode(procB.plaintext));

console.log('Testing grpA decrypting ct from A:');
try {
	const procA = grpA.processMessage(ct);
	console.log('A result:', procA.type, new TextDecoder().decode(procA.plaintext));
} catch (e) {
	console.error('A failed to decrypt own message:', e.message);
}

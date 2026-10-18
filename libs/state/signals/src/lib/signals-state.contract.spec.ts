import { runStateContractSuite } from '@shop/state/contracts/testing';
import { provideSignalsState } from './provide-signals-state';

runStateContractSuite('signals', provideSignalsState);

import { runStateContractSuite } from '@shop/state/contracts/testing';
import { provideNgrxState } from './provide-ngrx-state';

runStateContractSuite('ngrx', provideNgrxState);

import { initEnv } from './utils/env';
import { initStore } from './utils/store';
import { startReplacementTranslationListener } from './daemon/replacement_translation';

initStore().then(initEnv).then(startReplacementTranslationListener);

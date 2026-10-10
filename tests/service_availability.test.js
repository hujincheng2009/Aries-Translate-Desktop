import assert from 'node:assert/strict';
import test from 'node:test';
import { filterAvailableServices } from '../src/utils/service_availability.js';

test('removed builtins and missing plugins are skipped without changing persisted lists', () => {
    const stored = ['ecdict@old', 'bing', 'lingva', 'plugin.demo@a', 'plugin.absent@b'];
    const snapshot = [...stored];
    const logged = [];
    assert.deepEqual(
        filterAvailableServices(stored, { bing: {} }, { 'plugin.demo': {} }, (key) => logged.push(key)),
        ['bing', 'plugin.demo@a']
    );
    assert.deepEqual(stored, snapshot);
    assert.deepEqual(logged, ['ecdict@old', 'lingva', 'plugin.absent@b']);
});

test('null list and prototype names are not available services', () => {
    assert.deepEqual(filterAvailableServices(null, {}), []);
    assert.deepEqual(filterAvailableServices(['constructor', 'toString'], {}), []);
});

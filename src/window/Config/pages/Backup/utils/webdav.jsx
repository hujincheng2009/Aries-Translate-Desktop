import { invoke } from '@tauri-apps/api';

export async function backup(url, username, password, name) {
    return await invoke('webdav', {
        operate: 'put',
        url,
        username,
        password,
        name,
    });
}

export async function list(url, username, password) {
    const backup_list_text = await invoke('webdav', {
        operate: 'list',
        url,
        username,
        password,
    });
    return JSON.parse(backup_list_text);
}

export async function get(url, username, password, name) {
    const _ = await invoke('webdav', {
        operate: 'get',
        url,
        username,
        password,
        name: name.path ?? name,
    });
}

export async function remove(url, username, password, name) {
    return await invoke('webdav', {
        operate: 'delete',
        url,
        username,
        password,
        name: name.path ?? name,
    });
}

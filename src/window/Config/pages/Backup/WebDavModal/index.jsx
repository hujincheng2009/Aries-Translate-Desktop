import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useToastStyle } from '../../../../../hooks';
import * as webdav from '../utils/webdav';
import BackupListDialog from '../BackupListDialog';

export default function WebDavModal(props) {
    const { isOpen, onOpenChange, url, username, password } = props;
    const [webdavList, setWebdavList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState([]);

    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            webdav.list(url, username, password).then(
                (v) => {
                    setWebdavList(v);
                    setDownloading(
                        v.map(() => {
                            return false;
                        })
                    );
                    setLoading(false);
                },
                (e) => {
                    toast.error(e.toString(), { style: toastStyle });
                    setLoading(false);
                }
            );
        }
    }, [isOpen]);

    const getBackup = async (name, onClose) => {
        webdav.get(url, username, password, name).then(
            () => {
                setDownloading(
                    downloading.map(() => {
                        return false;
                    })
                );
                toast.success(t('config.backup.load_success'), { style: toastStyle });
                onClose();
            },
            (e) => {
                setDownloading(
                    downloading.map(() => {
                        return false;
                    })
                );
                toast.error(e.toString(), { style: toastStyle });
                onClose();
            }
        );
    };

    return (
        <BackupListDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            loading={loading}
            files={webdavList}
            downloading={downloading}
            onRestore={async (file, index) => {
                setDownloading(
                    downloading.map((_, i) => {
                        return i === index;
                    })
                );
                await getBackup(file, () => onOpenChange(false));
            }}
            onDelete={(file, index) => {
                webdav.remove(url, username, password, file).then(
                    () => {
                        setWebdavList(
                            webdavList.filter((_, i) => {
                                return i !== index;
                            })
                        );
                    },
                    (e) => {
                        toast.error(e.toString(), { style: toastStyle });
                    }
                );
            }}
        />
    );
}

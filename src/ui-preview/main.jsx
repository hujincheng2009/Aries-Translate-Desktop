// Dev-only component preview (open http://localhost:1420/ui-preview.html while `pnpm dev` runs).
// Shows every ui/ component in light and dark side by side for comparison with the Figma file.
import ReactDOM from 'react-dom/client';
import React, { useState } from 'react';
import {
    CopyIcon,
    LanguagesIcon,
    PlusIcon,
    SettingsIcon,
    Trash2Icon,
    TriangleAlertIcon,
    Volume2Icon,
} from 'lucide-react';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, Separator, Skeleton, Slider, Spinner } from '@/components/ui/misc';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import '../style.css';

function Section({ title, children }) {
    return (
        <section className='flex flex-col gap-3'>
            <h2 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>{title}</h2>
            <div className='flex flex-wrap items-center gap-3'>{children}</div>
        </section>
    );
}

function Showcase() {
    const [checked, setChecked] = useState(true);
    return (
        <div className='flex flex-col gap-8'>
            <Section title='Button'>
                {['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'].map((variant) => (
                    <Button
                        key={variant}
                        variant={variant}
                    >
                        {variant}
                    </Button>
                ))}
            </Section>
            <Section title='Button sizes'>
                <Button size='sm'>
                    <PlusIcon />
                    添加内置服务
                </Button>
                <Button variant='outline'>
                    <SettingsIcon />
                    默认 36px
                </Button>
                <Button
                    variant='outline'
                    size='lg'
                >
                    大号 40px
                </Button>
                <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label='speak'
                >
                    <Volume2Icon />
                </Button>
                <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label='copy'
                >
                    <CopyIcon />
                </Button>
                <Button
                    size='icon-sm'
                    aria-label='translate'
                >
                    <LanguagesIcon />
                </Button>
                <Button
                    variant='outline'
                    disabled
                >
                    已禁用
                </Button>
            </Section>
            <Section title='Form controls'>
                <Input
                    className='w-40'
                    defaultValue='60828'
                />
                <Input
                    className='w-48'
                    placeholder='http://127.0.0.1'
                />
                <Select defaultValue='zh_cn'>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='auto'>自动检测</SelectItem>
                        <SelectItem value='zh_cn'>简体中文</SelectItem>
                        <SelectItem value='en'>英语</SelectItem>
                    </SelectContent>
                </Select>
                <Switch
                    checked={checked}
                    onCheckedChange={setChecked}
                />
                <Switch />
                <Switch disabled />
                <div className='flex items-center gap-2'>
                    <Checkbox id='od' />
                    <Label htmlFor='od'>按需调用</Label>
                </div>
                <Checkbox defaultChecked />
            </Section>
            <Section title='Textarea · Slider · Progress'>
                <Textarea
                    className='w-72'
                    defaultValue='Aries is a cross-platform software for text translation and recognition.'
                />
                <Slider
                    className='w-48'
                    defaultValue={[27]}
                />
                <Progress
                    className='w-48'
                    value={62}
                />
            </Section>
            <Section title='Tabs'>
                <Tabs defaultValue='translate'>
                    <TabsList>
                        <TabsTrigger value='translate'>翻译</TabsTrigger>
                        <TabsTrigger value='recognize'>文字识别</TabsTrigger>
                        <TabsTrigger value='tts'>语音合成</TabsTrigger>
                        <TabsTrigger value='collection'>生词本</TabsTrigger>
                    </TabsList>
                    <TabsContent
                        value='translate'
                        className='text-sm text-muted-foreground'
                    >
                        翻译服务列表
                    </TabsContent>
                </Tabs>
            </Section>
            <Section title='Badge · Kbd · Spinner · Skeleton'>
                <Badge>default</Badge>
                <Badge variant='secondary'>英语</Badge>
                <Badge variant='outline'>Gemini 语音合成</Badge>
                <Badge variant='destructive'>失败</Badge>
                <KbdGroup>
                    <Kbd>Ctrl</Kbd>
                    <Kbd>Alt</Kbd>
                    <Kbd>Q</Kbd>
                </KbdGroup>
                <Spinner />
                <Skeleton className='h-4 w-32' />
            </Section>
            <Section title='Card'>
                <Card className='w-full'>
                    <CardHeader>
                        <CardTitle>启动</CardTitle>
                        <CardDescription>应用启动、更新与外部调用</CardDescription>
                    </CardHeader>
                    <CardContent className='text-sm'>卡片内容</CardContent>
                    <CardFooter className='justify-end gap-2'>
                        <Button variant='outline'>恢复备份</Button>
                        <Button>立即备份</Button>
                    </CardFooter>
                </Card>
            </Section>
            <Section title='Alert'>
                <Alert variant='warning'>
                    <TriangleAlertIcon />
                    <AlertDescription>
                        隐藏窗口或剪贴板监听等后台流程如需自动得到结果，请至少保留一个已启用且未勾选“按需调用”的翻译服务。
                    </AlertDescription>
                </Alert>
                <Alert variant='destructive'>
                    <TriangleAlertIcon />
                    <AlertTitle>测试失败</AlertTitle>
                    <AlertDescription>API Key 无效，请在服务设置中检查。</AlertDescription>
                </Alert>
            </Section>
            <Section title='Table'>
                <div className='w-full overflow-hidden rounded-xl border shadow-xs'>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>原文</TableHead>
                                <TableHead>语言</TableHead>
                                <TableHead>译文</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell>serendipity</TableCell>
                                <TableCell className='text-muted-foreground'>英 → 中</TableCell>
                                <TableCell>机缘凑巧</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>incremental translation</TableCell>
                                <TableCell className='text-muted-foreground'>英 → 中</TableCell>
                                <TableCell>增量翻译</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </Section>
            <Section title='Overlays (portals render with the page theme)'>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant='outline'>Dialog</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>添加服务</DialogTitle>
                            <DialogDescription>选择要添加的翻译服务</DialogDescription>
                        </DialogHeader>
                        <Input placeholder='搜索服务' />
                        <DialogFooter>
                            <Button variant='outline'>取消</Button>
                            <Button>保存</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant='destructive'>
                            <Trash2Icon />
                            清空历史
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>清空所有历史记录？</AlertDialogTitle>
                            <AlertDialogDescription>此操作无法撤销，所有翻译历史都将被删除。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction variant='destructive'>清空</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant='outline'>Dropdown</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem>编辑</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant='destructive'>删除</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant='ghost'
                            size='icon-sm'
                        >
                            <CopyIcon />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>复制</TooltipContent>
                </Tooltip>
            </Section>
            <Separator />
        </div>
    );
}

function Preview() {
    const [pageDark, setPageDark] = useState(false);
    return (
        <TooltipProvider>
            <div className={pageDark ? 'dark' : ''}>
                <div className='min-h-screen bg-muted p-6 text-foreground'>
                    <div className='mb-4 flex items-center justify-between'>
                        <h1 className='text-lg font-semibold'>Aries UI · Vega preview</h1>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => {
                                setPageDark(!pageDark);
                                document.documentElement.classList.toggle('dark', !pageDark);
                            }}
                        >
                            页面主题：{pageDark ? '深色' : '浅色'}
                        </Button>
                    </div>
                    <div className='grid grid-cols-2 gap-6'>
                        <div className='rounded-xl bg-background p-6'>
                            <Showcase />
                        </div>
                        <div className='dark rounded-xl bg-background p-6 text-foreground'>
                            <Showcase />
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}

document.documentElement.style.overflow = 'auto';
ReactDOM.createRoot(document.getElementById('root')).render(<Preview />);

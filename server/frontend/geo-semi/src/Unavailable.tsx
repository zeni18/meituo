import {PlatformLabel} from './PlatformLogo';
import {Banner,Button,Card,Form,Space,Table,Tag} from '@douyinfe/semi-ui';
import {popup,platforms,Row} from './api';
import {blank,FieldNote,useGeo} from './shared';
const definitions:Row={
 'b2b-sites':{title:'B2B行业网站',guide:'需取得B2B站点的发布接口与商用账号授权，由管理端开通。',columns:['行业网站','行业领域','授权状态'],next:'contacts',nextLabel:'管理联系方式'},
 'b2b-tasks':{title:'B2B自动发布任务',guide:'B2B发布通道尚未开通。开通后才可选择站点并创建自动发布任务。',columns:['任务名称','目标站点','文章数量','状态','创建时间']},
 'b2b-records':{title:'B2B发布记录',guide:'此处仅展示B2B通道真实回执，媒体采购订单请在网站媒体或自媒体大V查看。',columns:['文章','目标站点','发布状态','回链','发布时间']},
 'website-tasks':{title:'AI智能发布任务',guide:'当前支持选择稿件和媒体后确认发布。定时批量调度尚未开通，当前不会自动发稿。',columns:['任务名称','稿件','目标媒体','发布状态'],next:'website',nextLabel:'选择媒体发布'},
 'accounts':{title:'账号授权',guide:'个人账号直发需逐平台授权。授权服务及凭证由平台、OEM和获授权代理管理，不在商家端录入上级密钥。',columns:['平台','账号名称','授权状态','有效期']},
 'owned-tasks':{title:'个人自媒体发布任务',guide:'请先由服务商开通账号直发能力并完成账号授权。',columns:['任务名称','稿件','账号','状态'],next:'accounts',nextLabel:'查看账号授权'},
 'owned-records':{title:'个人自媒体发布记录',guide:'完成账号授权并实际发布后，回执将记录在此。',columns:['平台','账号','文章','回链','发布时间']},
 'seo-tasks':{title:'SEO发布任务',guide:'CMS发布适配及站点写入权限尚未开通。可以先维护站点资料。',columns:['任务名称','站点','文章','状态'],next:'sites',nextLabel:'管理站点资料'},
 'seo-records':{title:'SEO发布记录',guide:'此处展示授权站点的真实发布回链，不生成模拟SEO数据。',columns:['站点','文章','状态','回链','发布时间'],next:'sites',nextLabel:'管理站点资料'},
 'diagnostic-reports':{title:'诊断报告',guide:'国内AI可见度监测尚未接入，暂无自动诊断报告。人工观察请在查询记录中查看。',columns:['诊断对象','目标平台','状态','诊断时间'],next:'evidence',nextLabel:'查看人工观察记录'},
 'keyword-index':{title:'关键词指数',guide:'需明确指数来源、地区、时间粒度及商用许可。关键词指数服务尚未接入，AI拓词不代表真实搜索量。',columns:['关键词','来源平台','指数','统计日期']}
};
export default function Unavailable({view}:{view:string}){const {navigate}=useGeo();if(view==='diagnose')return <><Banner type="warning" closeIcon={null} description="国内AI可见度诊断尚未开通。监测服务和授权由管理端配置；OEM可申请借用平台能力。"/><Form labelPosition="top"><div className="gs-form-grid"><Form.Input field="brand" label="品牌 / 企业名称" placeholder="输入实际品牌名称"/><Form.Input field="website" label="官方网站" placeholder="https://"/></div><Form.TextArea field="questions" label="诊断问题" placeholder="每行一个真实客户问题" rows={6}/><Form.CheckboxGroup field="platforms" label="目标平台" options={platforms.map(p=>({value:p,label:<PlatformLabel name={p}/>}))}/><FieldNote>开通后将保留平台、问题、原文、引用来源和检测时间。当前不提交任务或产生消耗。</FieldNote><Space><Button theme="solid" disabled>提交可见度诊断（待开通）</Button><Button onClick={()=>navigate('diagnostic-reports')}>诊断报告</Button><Button onClick={()=>navigate('evidence')}>记录人工证据</Button></Space></Form></>;
 const d=definitions[view];return <><Banner type="warning" closeIcon={null} description={d.guide}/><div className="gs-availability"><Tag color="orange">待服务商开通</Tag><FieldNote>平台 / OEM / 获授权代理管理配置，商家仅使用已授权能力。</FieldNote>{d.next&&<Button onClick={()=>navigate(d.next)}>{d.nextLabel}</Button>}</div>{view==='keyword-index'&&<Form layout="horizontal"><Form.Input field="keyword" noLabel placeholder="关键词"/><Form.Select field="source" noLabel placeholder="数据来源待开通" getPopupContainer={popup} disabled/><Button disabled>查询指数</Button></Form>}<Table pagination={false} rowKey="id" dataSource={[]} columns={d.columns.map((title:string,i:number)=>({title,dataIndex:'field'+i}))} empty={blank('通道尚未开通，暂无真实业务记录。')}/><Card className="gs-section-card" title="开通与授权"><p>请联系所属服务商开通对应接口。供应商凭证保存在管理端，使用当前平台的算力标准和授权范围。</p><FieldNote>OEM可逐项申请借用平台能力；代理需OEM授予使用或自配权限。</FieldNote></Card></>;}

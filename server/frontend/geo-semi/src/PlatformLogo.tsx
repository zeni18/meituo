const assets:Record<string,string>={
 '豆包':'doubao.png',DeepSeek:'deepseek.ico','腾讯元宝':'yuanbao.png','通义千问':'qianwen.png',Kimi:'kimi.png','文心一言':'wenxin.png','纳米AI':'nano.svg','智谱AI':'zhipu.ico'
};
const aliases:Record<string,string>={'千问':'通义千问',Qwen:'通义千问','元宝':'腾讯元宝','文心':'文心一言','纳米':'纳米AI',deepseek:'DeepSeek',kimi:'Kimi','智谱清言':'智谱AI'};
export function PlatformLogo({name,className=''}:{name:string;className?:string}){const file=assets[aliases[name]||name];return file?<img className={'gp-logo '+className} src={'/merchant/images/platforms/'+file} alt={name+' Logo'} width={40} height={40}/>:<span className={'gp-logo gp-logo-unknown '+className} aria-hidden="true">◎</span>;}
export function PlatformLabel({name}:{name:string}){return <span className="gp-label"><PlatformLogo name={name}/><span>{name}</span></span>;}

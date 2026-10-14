import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Promptfolio — библиотека промптов',description:'Ваши удачные промпты, результаты и референсы в одном месте.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="ru"><body>{children}</body></html>;}

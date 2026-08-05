import TournamentWorkspace from "../../../components/TournamentWorkspace";
export const metadata={title:"Tournament Bracket",robots:{index:false,follow:false}};
export default async function Page({params}){const {slug}=await params;return <TournamentWorkspace slug={slug}/>;}

import { notFound } from "next/navigation";
import { TEAM_MEMBERS } from "../../data/team";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const member = TEAM_MEMBERS.find(
        (person) => person.id === id
    );

    if (!member) {
        notFound();
    }

    return <ProfileClient member={member} />;
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { TEAM_MEMBERS } from "./data/team";

export default function HomePage() {
    return (
        <main className="min-h-screen bg-gray-50">
            <section className="mx-auto max-w-6xl px-6 py-16">
                <div className="mb-12 text-center">
                    <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                        Our Team </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
                        Meet the team at the Dr. Gilles Arcand Centre for Health Equity.
                        Explore each team member&apos;s collaboration network and
                        publications.
                    </p>
                </div>

                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {TEAM_MEMBERS.map((member) => (
                        <Link
                            key={member.id}
                            href={`/profile/${member.id}`}
                            className="group"
                        >
                            <article className="h-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
                                <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                                    <Image
                                        src={member.src}
                                        alt={member.name}
                                        fill
                                        className="object-cover transition duration-300 group-hover:scale-105"
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    />
                                </div>

                                <div className="p-6">
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {member.name}
                                    </h2>

                                    <p className="mt-2 text-sm font-medium text-gray-700">
                                        {member.title}
                                    </p>

                                    <p className="mt-2 text-sm leading-6 text-gray-500">
                                        {member.desc}
                                    </p>

                                    <div className="mt-5 text-sm font-medium text-gray-900">
                                        View profile
                                        <span className="ml-2 transition group-hover:ml-3">
                                            →
                                        </span>
                                    </div>
                                </div>
                            </article>
                        </Link>
                    ))}
                </div>
            </section>
        </main>
    );
}
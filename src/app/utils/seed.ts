import { Role } from "../../generated/prisma/enums"
import config from "../config"
import { prisma } from "../lib/prisma"
import bcrypt from "bcryptjs"

export const seedSuperAdmin = async () => {
    try {
        const isSuperAdminExists = await prisma.user.findFirst({
            where: {
                role: Role.SUPER_ADMIN
            }
        })

        if (isSuperAdminExists) {
            console.log("Super Admin Already Exists!");
            return
        }

        const name = config.super_admin_name
        const email = config.super_admin_email
        const password = config.super_admin_password

        if (!name || !email || !password) {
            throw new Error("Name, Email, Password is missing from .env!")
        }

        const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds))

        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: Role.SUPER_ADMIN,
                needPasswordChange: false,
                emailVerified: true
            }
        })

        console.log("Super Admin Created!");
    } catch (error) {
        console.log(error);

        await prisma.user.delete({
            where: {
                email: config.super_admin_email
            }
        })
    }
}

export const seedTesterAdmin = async () => {
    try {
        const isAdminExists = await prisma.user.findFirst({
            where: {
                role: Role.ADMIN
            }
        })

        if (isAdminExists) {
            console.log("Admin Already Exists!");
            return
        }

        const name = config.tester_admin_name
        const email = config.tester_admin_email
        const password = config.tester_admin_password

        if (!name || !email || !password) {
            throw new Error("Name, Email, Password is missing from .env!")
        }

        const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds))

        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: Role.ADMIN,
                needPasswordChange: false,
                emailVerified: true
            }
        })

        console.log("Tester Admin Created!");
    } catch (error) {
        console.log(error);

        await prisma.user.delete({
            where: {
                email: config.tester_admin_email
            }
        })
    }
}

export const seedDoctor = async () => {
    try {
        const isDoctorExists = await prisma.user.findFirst({
            where: {
                role: Role.DOCTOR
            }
        })

        if (isDoctorExists) {
            console.log("Doctor Already Exists!");
            return
        }

        const name = config.tester_doctor_name
        const email = config.tester_doctor_email
        const password = config.tester_doctor_password

        if (!name || !email || !password) {
            throw new Error("Name, Email, Password is missing from .env!")
        }

        const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds))

        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: Role.DOCTOR,
                needPasswordChange: false,
                emailVerified: true,
                doctor: {
                    create: {
                        name,
                        email,
                        experienceYears: 5,
                        qualifications: "MBBS",
                        licensNumber: "BMDC25555",
                        specializations: "Neurology"
                    }
                }
            }
        })

        console.log("Tester Doctor Created!");
    } catch (error) {
        console.log(error);

        await prisma.user.delete({
            where: {
                email: config.tester_doctor_email
            }
        })
    }
}
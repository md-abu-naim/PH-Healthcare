import cron from 'node-cron';

export const DeletedUnverifiedDoctors = async () => {
    cron.schedule('* * * * *', () => {
        console.log('running a task every minute');
    });
}